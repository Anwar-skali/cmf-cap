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

    // 3 source modules are reorganized into the role sections the Manuel Project
    // workflow renders (Buyer + SQD for this fixture; General for leftovers).
    expect(result.detectedModuleCount).toBe(3);
    expect(result.sections.map((s) => s.id)).toEqual(['sec_buyer', 'sec_sqd', 'sec_general']);
    expect(result.sections.map((s) => s.name)).toEqual(['Buyer', 'SQD', 'General']);

    // 3 source tables preserved as groups.
    expect(result.detectedTableCount).toBe(3);

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

    // Fields are distributed under the correct role sections.
    const sectionOf = (fieldName: string) =>
      result.sections.find((s) => s.groups.some((g) => g.fields.some((f) => f.internalName === fieldName)))?.id;
    expect(sectionOf('supplier_code')).toBe('sec_buyer');
    expect(sectionOf('supplier_name')).toBe('sec_buyer');
    expect(sectionOf('quality_score')).toBe('sec_sqd');
    expect(sectionOf('evaluation')).toBe('sec_sqd');
    expect(sectionOf('project_code')).toBe('sec_general');

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

    // Each role section preserves its groups; group ids are unique across sections.
    const groupIds = result.sections.flatMap((s) => s.groups.map((g) => g.id));
    expect(new Set(groupIds).size).toBe(groupIds.length);

    // All 11 fields survive, preserving per-field order within each group.
    expect(allFields(result)).toHaveLength(11);
    result.sections.forEach((s) =>
      s.groups.forEach((g) => {
        const orders = g.fields.map((f) => f.order as number);
        expect(orders).toEqual([...orders].sort((a, b) => a - b));
      }),
    );
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

  it('preserves explicit role and permissions metadata on imported fields', () => {
    const result = ProjectStructureExtractor.extractFromJson({
      structure: { name: 'R', code: 'R', version: '1.0' },
      modules: [
        {
          code: 'M',
          name: 'Module',
          tables: [
            {
              name: 'master',
              fields: [
                { name: 'capacity', label: 'Capacity', type: 'integer', role: 'CAPACITY_MANAGER' },
                {
                  name: 'quality_score',
                  label: 'Quality Score',
                  type: 'percentage',
                  permissions: { rolesAllowedToEdit: ['sqd', 'admin'] },
                },
                { name: 'supplier_name', label: 'Supplier Name', type: 'text' },
              ],
            },
          ],
        },
      ],
    });

    const byName: Record<string, any> = Object.fromEntries(allFields(result).map((f) => [f.internalName, f]));

    // Explicit `role` wins over name heuristics and is persisted as permissions.
    expect(byName['capacity'].permissions.rolesAllowedToEdit).toEqual(['capacity_manager', 'admin']);
    const sectionOf = (fieldName: string) =>
      result.sections.find((s) => s.groups.some((g) => g.fields.some((f) => f.internalName === fieldName)))?.id;
    expect(sectionOf('capacity')).toBe('sec_capacity_manager');

    // Explicit permissions are preserved and drive classification.
    expect(byName['quality_score'].permissions.rolesAllowedToEdit).toEqual(['sqd', 'admin']);
    expect(sectionOf('quality_score')).toBe('sec_sqd');

    // Name-based classification still works, and role sections carry permissions.
    expect(sectionOf('supplier_name')).toBe('sec_buyer');
    const buyerSection = result.sections.find((s) => s.id === 'sec_buyer');
    expect(buyerSection?.permissions?.rolesAllowedToEdit).toEqual(['buyer', 'admin']);
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

  it('correctly extracts fields directly under modules (Task 1 structure)', () => {
    const task1Json = {
      code: 'TEST_CMF_STRUCTURE',
      name: 'CMF Test Structure',
      version: '1.0',
      status: 'DRAFT',
      description: 'Test project structure',
      orientation: 'VERTICAL',
      modules: [
        {
          name: 'Project',
          fields: [
            { name: 'project_code', type: 'text', required: true },
            { name: 'project_name', type: 'text', required: true },
            { name: 'customer', type: 'text', required: true },
            { name: 'project_status', type: 'status', required: true },
          ],
        },
        {
          name: 'Supplier',
          fields: [
            { name: 'supplier_code', type: 'text', required: true },
            { name: 'supplier_name', type: 'text', required: true },
            { name: 'country', type: 'text', required: false },
          ],
        },
        {
          name: 'Quality Assessment',
          fields: [
            { name: 'assessment_date', type: 'date', required: true },
            { name: 'quality_score', type: 'percentage', required: true },
            {
              name: 'evaluation',
              type: 'dropdown',
              required: true,
              options: [
                { label: 'Passed', value: 'PASSED' },
                { label: 'Failed', value: 'FAILED' },
                { label: 'Pending', value: 'PENDING' },
              ],
            },
          ],
        },
      ],
      relationships: [
        { from: 'Project', to: 'Supplier', type: 'many-to-one' },
        { from: 'Project', to: 'Quality Assessment', type: 'one-to-many' },
      ],
    };

    const result = ProjectStructureExtractor.extractFromJson(task1Json);

    expect(result.code).toBe('TEST_CMF_STRUCTURE');
    expect(result.name).toBe('CMF Test Structure');
    expect(result.version).toBe('1.0');
    expect(result.status).toBe('DRAFT');
    expect(result.orientation).toBe('VERTICAL');

    // Expected: 3 source modules reorganized into role sections, 10 fields total
    expect(result.detectedModuleCount).toBe(3);
    expect(result.detectedFieldCount).toBe(10);
    expect(result.detectedRelationshipCount).toBe(2);

    expect(result.sections.map((s) => s.name)).toEqual(['Buyer', 'SQD', 'General']);

    const fields = allFields(result);
    const byName = Object.fromEntries(fields.map((f) => [f.internalName, f]));
    expect(fields.length).toBe(10);
    expect(byName['supplier_code'].required).toBe(true);
    expect(byName['country'].required).toBe(false);

    const evaluationField = byName['evaluation'];
    expect(evaluationField).toBeDefined();
    expect(evaluationField?.type).toBe('dropdown');
    expect(evaluationField?.options).toEqual([
      { value: 'PASSED', label: 'Passed', order: 1 },
      { value: 'FAILED', label: 'Failed', order: 2 },
      { value: 'PENDING', label: 'Pending', order: 3 },
    ]);
  });
});