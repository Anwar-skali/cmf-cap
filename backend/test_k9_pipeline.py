import asyncio, openpyxl, json, uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.infrastructure.persistence.models.base import Base
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.services.template_service import TemplateService
from app.application.services.template_context_service import TemplateContextService
from app.application.services.ollama_mapping_service import OllamaMappingService
from app.application.services.excel_header_extractor import ExcelHeaderExtractor
from app.application.services.import_engine_service import ImportEngineService

async def test_k9_import():
    fn = '../CMF_K9_12.5K_DEX.xlsm'
    with open(fn, 'rb') as f:
        file_bytes = f.read()
        
    engine = create_async_engine('sqlite+aiosqlite:///:memory:', echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        uow = UnitOfWork(session)
        from app.infrastructure.persistence.models.template import Template
        with open('app/infrastructure/persistence/seeds/seed_data.json', 'r', encoding='utf-8') as sf:
            sdata = json.load(sf)
        for t in sdata.get('templates', []):
            if t.get('code') == 'K9':
                schema = json.loads(t['schema_json']) if isinstance(t['schema_json'], str) else t['schema_json']
                tmpl = Template(
                    id=uuid.uuid4(),
                    code=t.get('code'),
                    name=t.get('name'),
                    description=t.get('description'),
                    version=t.get('version', '1.0'),
                    status='PUBLISHED',
                    schema_json=schema
                )
                session.add(tmpl)
        await session.commit()
        
        ctx_svc = TemplateContextService(uow)
        tmpl_ctx = await ctx_svc.get_template_context("K9")
        print(f"K9 context loaded with {len(tmpl_ctx.fields)} fields.")

        # Extract headers with auto sheet detection or specified
        headers, det_row, conf, sheet_used, s_conf, previews, read_ms, orient = ExcelHeaderExtractor.extract_headers_with_details(
            file_bytes, specified_sheet_name="CMF K9 12.5K DEX", specified_header_row=3
        )
        print(f"Sheet used: '{sheet_used}', Header row: {det_row}, Headers count: {len(headers)}")

        ollama_svc = OllamaMappingService()
        map_res = await ollama_svc.generate_mapping(tmpl_ctx, headers)
        mapping = map_res.get("mapping", {})
        print("\n=== AI / DETERMINISTIC MAPPING RESULTS ===")
        custom_mapping = {}
        for f_key, info in mapping.items():
            ex = info.get("excel")
            if ex:
                custom_mapping[ex] = f_key
                print(f"  {f_key:25s} -> {repr(ex):35s} (conf={info.get('confidence')}, src={info.get('source')})")
            else:
                print(f"  {f_key:25s} -> UNMAPPED")

        svc = ImportEngineService(uow)
        preview = await svc.preview_and_validate(
            file_bytes=file_bytes,
            file_name='CMF_K9_12.5K_DEX.xlsm',
            entity_type='K9',
            custom_mapping=custom_mapping,
            sheet_name='CMF K9 12.5K DEX',
            header_row=3
        )
        print("\n=== PREVIEW & VALIDATE ===")
        print(f"Total rows: {preview.get('total_rows')}")
        print(f"Valid rows: {preview.get('valid_rows_count')}")
        print(f"Empty rows: {preview.get('empty_rows_count')}")
        print(f"Error rows: {preview.get('error_rows_count')}")
        val_errors = preview.get('validation_errors', [])
        print(f"Total validation error items: {len(val_errors)}")
        
        error_types = {}
        for err in val_errors:
            et = err.get('error_type', 'Unknown')
            col = err.get('column_name', '')
            msg = err.get('message', '')
            key = f"{et} on {col}: {msg}"
            error_types[key] = error_types.get(key, 0) + 1
            
        print("\nBreakdown of validation errors:")
        for err_desc, cnt in error_types.items():
            print(f"  [{cnt} times] {err_desc}")
            
        # Sample error rows
        print("\nSample 5 validation errors:")
        for err in val_errors[:5]:
            print(" ", err)

    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(test_k9_import())
