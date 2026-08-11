import { describe, expect, it } from 'vitest';
import { ProjectStructureExtractor, StructureExtractResult } from './ProjectStructureExtractor';

const CMF_SUPPLIER_JSON = {
  structure: {
    name: 'CMF Supplier Management',
    code: 'CMF_SUPPLIER',
    version: '1.0',
    status: 'DRAFT',
    description: 'Supplier management project structure',
  },
  modules: [
    {
      code: 'PROJECT',
      name: 'Project Management',
      tables: [
        {
          name: 'project',
          fields: [
            { name: 'project_code', label: 'Project Code', type: 'string', required: true },
            { name: 'project_name', label: 'Project Name', type: 'string', required: true },
            { name: 'customer', label: 'Customer', type: 'string', required: true },
            { name: 'project_status', label: 'Project Status', type: 'status', required: true },
          ],
        },
      ],
    },
    {
      code: 'SUPPLIER',
      name: 'Supplier Management',
      tables: [
        {
          name: 'supplier',
          fields: [
            { name: 'supplier_code', label: 'Supplier Code', type: 'string', required: true },
            { name: 'supplier_name', label: 'Supplier Name', type: 'string', required: true },
            { name: 'country', label: 'Country', type: 'string', required: false },
            { name: 'supplier_status', label: 'Supplier Status', type: 'status', required: true },
          ],
        },
      ],
    },
    {
      code: 'QUALITY',
      name: 'Quality Management',
      tables: [
        {
          name: 'quality_assessment',
          fields: [
            { name: 'assessment_date', label: 'Assessment Date', type: 'date', required: true },
            { name: 'quality_score', label: 'Quality Score', type: 'percentage', required: false },
            { name: 'evaluation', label: 'Evaluation', type: 'status', required: true },
          ],
        },
      ],
    },
  ],
  relationships: [
    { from: 'project', to: 'supplier', type: 'one_to_many' },
    { from: 'supplier', to: 'quality_assessment', type: 'one_to_many' },
  ],
};

function allFields(result: StructureExtractResult) {
  return result.sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
}

describe('ProjectStructureExtractor.extractFromJson', () => {
  it('maps hierarchical modules/tables/fields without flattening top-level containers', () => {
    const result = ProjectStructureExtractor.extractFromJson(CMF_SUPPLIER_JSON, 'supplier.json');

    expect(result.status).toBe('DRAFT');
    expect(result.orientation).toBe('HORIZONTAL');

    // 3 modules -> 3 sections
    expect(result.detectedModuleCount).toBe(3);
    expect(result.sections.map((s) => s.name)).toEqual([
      'Project Management',
      'Supplier Management',
      'Quality Management',
    ]);

    // 3 tables -> 3 groups
    const tables = result.sections.flatMap((s) => s.groups);
    expect(result.detectedTableCount).toBe(3);
    expect(tables.map((t) => t.name)).toEqual(['project', 'supplier', 'quality_assessment']);

    // 11 fields — and no top-level 'modules'/'tables'/'relationships' pseudo-fields
    const fields = allFields(result);
    expect(result.detectedFieldCount).toBe(11);
    expect(fields.length).toBe(11);
    const names = fields.map((f) => f.internalName);
    expect(names).not.toContain('modules');
    expect(names).not.toContain('tables');
    expect(names).not.toContain('relationships');
    expect(names).toContain('project_code');
    expect(names).toContain('evaluation');

    // 2 relationships, preserved verbatim
    expect(result.detectedRelationshipCount).toBe(2);
    expect(result.relationships).toEqual([
      { from: 'project', to: 'supplier', type: 'one_to_many' },
      { from: 'supplier', to: 'quality_assessment', type: 'one_to_many' },
    ]);
  });

  it('normalizes JSON field types onto the CMF vocabulary', () => {
    const result = ProjectStructureExtractor.extractFromJson(CMF_SUPPLIER_JSON);
    const byName = Object.fromEntries(allFields(result).map((f) => [f.internalName, f]));

    expect(byName['project_code'].type).toBe('text');
    expect(byName['assessment_date'].type).toBe('date');
    expect(byName['quality_score'].type).toBe('percentage');
    expect(byName['evaluation'].type).toBe('status');
    expect(byName['project_code'].required).toBe(true);
    expect(byName['country'].required).toBe(false);
  });

  it('keeps raw order of modules, tables, and fields through the nested shape', () => {
    const result = ProjectStructureExtractor.extractFromJson(CMF_SUPPLIER_JSON);
    expect(result.sections.map((s) => s.order)).toEqual([1, 2, 3]);
    expect(result.sections.map((s) => s.groups.map((g) => g.order))).toEqual([[1], [1], [1]]);
    expect(result.sections.map((s) => s.groups.map((g) => g.fields.map((f) => f.order)))).toEqual([
      [[1, 2, 3, 4]],
      [[1, 2, 3, 4]],
      [[1, 2, 3]],
    ]);
  });

  it('preserves options (string + object form) and default values from JSON fields', () => {
    const result = ProjectStructureExtractor.extractFromJson({
      structure: { name: 'S', code: 'S', version: '1.0' },
      modules: [
        {
          code: 'QUALITY',
          name: 'Quality',
          tables: [
            {
              name: 'quality_assessment',
              fields: [
                {
                  name: 'evaluation',
                  label: 'Evaluation',
                  type: 'status',
                  required: true,
                  options: ['GREEN', 'ORANGE', 'RED', 'OPEN'],
                  default: 'GREEN',
                },
                {
                  name: 'capacity_unit',
                  label: 'Capacity Unit',
                  type: 'dropdown',
                  required: true,
                  options: [
                    { value: 'pcs-sem', label: 'PCS / Semester', order: 1 },
                    { value: 'pcs-week', label: 'PCS / Week', order: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const byName = Object.fromEntries(allFields(result).map((f) => [f.internalName, f]));

    expect(byName['evaluation'].options).toEqual([
      { value: 'GREEN', label: 'GREEN', order: 1 },
      { value: 'ORANGE', label: 'ORANGE', order: 2 },
      { value: 'RED', label: 'RED', order: 3 },
      { value: 'OPEN', label: 'OPEN', order: 4 },
    ]);
    expect(byName['evaluation'].defaultValue).toBe('GREEN');
    expect(byName['evaluation'].type).toBe('status');
    expect(byName['evaluation'].required).toBe(true);

    expect(byName['capacity_unit'].options).toEqual([
      { value: 'pcs-sem', label: 'PCS / Semester', order: 1 },
      { value: 'pcs-week', label: 'PCS / Week', order: 2 },
    ]);
    expect(byName['capacity_unit'].defaultValue).toBeUndefined();
  });

  it('falls back to defaultValue when default is absent on a normalized CMF layout', () => {
    const result = ProjectStructureExtractor.extractFromJson({
      code: 'CMF_NORMALIZED',
      name: 'Normalized',
      sections: [
        {
          name: 'Quality',
          groups: [
            {
              name: 'qa',
              fields: [
                {
                  internalName: 'evaluation',
                  label: 'Evaluation',
                  type: 'status',
                  required: true,
                  options: [{ value: 'GREEN', label: 'GREEN' }],
                  defaultValue: 'GREEN',
                },
              ],
            },
          ],
        },
      ],
    });
    const field = result.sections[0].groups[0].fields[0];
    expect(field.options).toEqual([{ value: 'GREEN', label: 'GREEN', order: 1 }]);
    expect(field.defaultValue).toBe('GREEN');
  });

  it('still parses an already-normalized CMF sections layout', () => {
    const result = ProjectStructureExtractor.extractFromJson({
      code: 'CMF_NORMALIZED',
      name: 'Normalized',
      status: 'PUBLISHED',
      sections: [
        {
          name: 'General',
          groups: [
            {
              name: 'Info',
              fields: [{ label: 'Part Number', type: 'string', required: true }],
            },
          ],
        },
      ],
    });

    expect(result.orientation).toBe('VERTICAL');
    expect(result.detectedModuleCount).toBe(1);
    expect(result.detectedTableCount).toBe(1);
    expect(result.detectedFieldCount).toBe(1);
    expect(result.sections[0].groups[0].fields[0]).toMatchObject({
      internalName: 'part_number',
      type: 'text',
      required: true,
    });
  });

  it('throws a structured error instead of flattening unknown top-level keys', () => {
    expect(() =>
      ProjectStructureExtractor.extractFromJson({ foo: 'bar', baz: 'qux', modules: 'not_a_list' }),
    ).toThrow(/Invalid Project Structure JSON/);
    expect(() => ProjectStructureExtractor.extractFromJson({ modules: 'not_a_list' })).toThrow(
      /Invalid Project Structure JSON/,
    );
    expect(() => ProjectStructureExtractor.extractFromJson('not json')).toThrow();
  });
});