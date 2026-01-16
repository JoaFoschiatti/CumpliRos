import { PrismaClient, Periodicity, TemplateSeverity, ObligationType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ID fijo para Rosario para facilitar referencias
const ROSARIO_JURISDICTION_ID = '00000000-0000-0000-0000-000000000001';

interface TemplateJson {
  templateKey: string;
  rubric: string;
  title: string;
  description?: string;
  type: keyof typeof ObligationType;
  defaultPeriodicity: keyof typeof Periodicity;
  defaultDueRule?: string;
  requiresReview: boolean;
  requiredEvidenceCount: number;
  severity: keyof typeof TemplateSeverity;
  references?: {
    links?: Array<{ url: string; title: string }>;
    notes?: string[];
  };
  checklist?: Array<{
    description: string;
    isRequired: boolean;
  }>;
}

interface JurisdictionJson {
  code: string;
  name: string;
  country: string;
  province?: string;
  templates: TemplateJson[];
}

async function seedJurisdictions() {
  console.log('🏛️  Seeding jurisdictions...');

  // Crear jurisdicción Rosario por defecto
  const rosario = await prisma.jurisdiction.upsert({
    where: { id: ROSARIO_JURISDICTION_ID },
    update: {},
    create: {
      id: ROSARIO_JURISDICTION_ID,
      code: 'ar-sf-rosario',
      name: 'Rosario',
      country: 'AR',
      province: 'Santa Fe',
      isActive: true,
    },
  });

  console.log(`✅ Jurisdiction created: ${rosario.name} (${rosario.code})`);
  return rosario;
}

async function loadTemplatesFromJson() {
  const templatesDir = path.join(__dirname, '..', 'templates', 'jurisdictions');

  if (!fs.existsSync(templatesDir)) {
    console.log('📁 Templates directory not found, skipping JSON import');
    return;
  }

  const jurisdictionDirs = fs.readdirSync(templatesDir);

  for (const jurisdictionCode of jurisdictionDirs) {
    const jurisdictionPath = path.join(templatesDir, jurisdictionCode);

    if (!fs.statSync(jurisdictionPath).isDirectory()) continue;

    // Buscar jurisdiction por código
    const jurisdiction = await prisma.jurisdiction.findUnique({
      where: { code: jurisdictionCode },
    });

    if (!jurisdiction) {
      console.log(`⚠️  Jurisdiction not found for code: ${jurisdictionCode}`);
      continue;
    }

    // Leer todos los archivos JSON de plantillas
    const templateFiles = fs.readdirSync(jurisdictionPath)
      .filter(f => f.endsWith('.json'));

    for (const file of templateFiles) {
      const filePath = path.join(jurisdictionPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const templates: TemplateJson[] = JSON.parse(content);

      for (const template of templates) {
        await upsertTemplate(jurisdiction.id, template);
      }
    }

    console.log(`📋 Templates loaded for ${jurisdiction.name}`);
  }
}

async function upsertTemplate(jurisdictionId: string, template: TemplateJson) {
  const existingTemplate = await prisma.obligationTemplate.findUnique({
    where: { templateKey: template.templateKey },
  });

  const templateData = {
    jurisdictionId,
    templateKey: template.templateKey,
    rubric: template.rubric,
    title: template.title,
    description: template.description,
    type: ObligationType[template.type],
    defaultPeriodicity: Periodicity[template.defaultPeriodicity],
    defaultDueRule: template.defaultDueRule,
    requiresReview: template.requiresReview,
    requiredEvidenceCount: template.requiredEvidenceCount,
    severity: TemplateSeverity[template.severity],
    references: template.references || null,
    isActive: true,
  };

  let obligationTemplate;

  if (existingTemplate) {
    // Incrementar versión si hay cambios
    obligationTemplate = await prisma.obligationTemplate.update({
      where: { templateKey: template.templateKey },
      data: {
        ...templateData,
        version: { increment: 1 },
        changelog: `Updated on ${new Date().toISOString()}`,
      },
    });
  } else {
    obligationTemplate = await prisma.obligationTemplate.create({
      data: templateData,
    });
  }

  // Crear/actualizar checklist items
  if (template.checklist && template.checklist.length > 0) {
    // Eliminar items existentes
    await prisma.checklistTemplateItem.deleteMany({
      where: { obligationTemplateId: obligationTemplate.id },
    });

    // Crear nuevos items
    await prisma.checklistTemplateItem.createMany({
      data: template.checklist.map((item, index) => ({
        obligationTemplateId: obligationTemplate.id,
        description: item.description,
        order: index,
        isRequired: item.isRequired,
      })),
    });
  }

  console.log(`  📝 Template: ${template.title}`);
}

async function seedRosarioTemplates() {
  console.log('📋 Seeding Rosario default templates...');

  const rosario = await prisma.jurisdiction.findUnique({
    where: { code: 'ar-sf-rosario' },
  });

  if (!rosario) {
    console.log('⚠️  Rosario jurisdiction not found, skipping templates');
    return;
  }

  // Plantillas por defecto para Rosario - Gastronomía
  const gastronomiaTemplates: TemplateJson[] = [
    {
      templateKey: 'rosario.gastronomia.habilitacion_comercial',
      rubric: 'gastronomia',
      title: 'Habilitación Comercial Municipal',
      description: 'Habilitación municipal obligatoria para operar un establecimiento gastronómico en Rosario',
      type: 'PERMIT',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar antes de fecha de vencimiento',
      requiresReview: true,
      requiredEvidenceCount: 1,
      severity: 'CRITICAL',
      references: {
        links: [
          { url: 'https://www.rosario.gob.ar/inicio/habilitaciones', title: 'Portal de Habilitaciones Rosario' }
        ],
        notes: ['Presentar personalmente en oficina de Habilitaciones']
      },
      checklist: [
        { description: 'Completar formulario de solicitud', isRequired: true },
        { description: 'Adjuntar plano del local aprobado', isRequired: true },
        { description: 'Presentar comprobante de tasa municipal', isRequired: true },
        { description: 'Adjuntar certificado de bomberos vigente', isRequired: true },
        { description: 'Presentar carnet sanitario de empleados', isRequired: false }
      ]
    },
    {
      templateKey: 'rosario.gastronomia.inspeccion_bromatologia',
      rubric: 'gastronomia',
      title: 'Inspección Bromatológica',
      description: 'Control sanitario periódico obligatorio por parte de Bromatología Municipal',
      type: 'INSPECTION',
      defaultPeriodicity: 'SEMIANNUAL',
      defaultDueRule: 'Coordinar con antelación',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      references: {
        notes: ['Mantener local en condiciones para inspección sorpresa']
      },
      checklist: [
        { description: 'Verificar limpieza general del establecimiento', isRequired: true },
        { description: 'Controlar temperaturas de heladeras y freezers', isRequired: true },
        { description: 'Revisar fechas de vencimiento de productos', isRequired: true },
        { description: 'Verificar carnets sanitarios vigentes', isRequired: true },
        { description: 'Revisar estado de extintores', isRequired: false }
      ]
    },
    {
      templateKey: 'rosario.gastronomia.carnet_manipulador',
      rubric: 'gastronomia',
      title: 'Carnet de Manipulador de Alimentos',
      description: 'Carnet obligatorio para todos los empleados que manipulan alimentos',
      type: 'PERMIT',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar antes de vencimiento',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      references: {
        links: [
          { url: 'https://www.rosario.gob.ar/inicio/carnet-sanitario', title: 'Trámite Carnet Sanitario' }
        ]
      },
      checklist: [
        { description: 'Realizar curso de manipulación de alimentos', isRequired: true },
        { description: 'Aprobar examen de conocimientos', isRequired: true },
        { description: 'Presentar certificado médico', isRequired: true },
        { description: 'Abonar tasa correspondiente', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.gastronomia.tasa_seguridad_higiene',
      rubric: 'gastronomia',
      title: 'Tasa de Seguridad e Higiene (TSeH)',
      description: 'Tributo municipal mensual sobre la facturación del establecimiento',
      type: 'TAX',
      defaultPeriodicity: 'MONTHLY',
      defaultDueRule: 'Vence el día 15 de cada mes',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      references: {
        links: [
          { url: 'https://www.rosario.gob.ar/inicio/tseh', title: 'Información TSeH' }
        ]
      },
      checklist: [
        { description: 'Calcular base imponible del período', isRequired: true },
        { description: 'Generar boleta de pago', isRequired: true },
        { description: 'Realizar pago en banco habilitado o home banking', isRequired: true },
        { description: 'Archivar comprobante de pago', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.gastronomia.seguro_responsabilidad_civil',
      rubric: 'gastronomia',
      title: 'Seguro de Responsabilidad Civil',
      description: 'Seguro obligatorio que cubre daños a terceros en el establecimiento',
      type: 'INSURANCE',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar antes de vencimiento de póliza',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      checklist: [
        { description: 'Solicitar cotización a aseguradora', isRequired: true },
        { description: 'Revisar cobertura y condiciones', isRequired: true },
        { description: 'Abonar prima anual o cuotas', isRequired: true },
        { description: 'Archivar póliza vigente', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.gastronomia.certificado_bomberos',
      rubric: 'gastronomia',
      title: 'Certificado de Bomberos',
      description: 'Certificado de condiciones contra incendio emitido por Bomberos Voluntarios',
      type: 'PERMIT',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Solicitar inspección con 30 días de anticipación',
      requiresReview: true,
      requiredEvidenceCount: 1,
      severity: 'CRITICAL',
      checklist: [
        { description: 'Solicitar turno de inspección', isRequired: true },
        { description: 'Verificar matafuegos cargados y vigentes', isRequired: true },
        { description: 'Revisar señalización de emergencia', isRequired: true },
        { description: 'Verificar salidas de emergencia despejadas', isRequired: true },
        { description: 'Presentar plano de evacuación', isRequired: false }
      ]
    }
  ];

  // Plantillas por defecto para Rosario - Comercio General
  const comercioTemplates: TemplateJson[] = [
    {
      templateKey: 'rosario.comercio.habilitacion_comercial',
      rubric: 'comercio',
      title: 'Habilitación Comercial Municipal',
      description: 'Habilitación municipal para operar un comercio en Rosario',
      type: 'PERMIT',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar antes de fecha de vencimiento',
      requiresReview: true,
      requiredEvidenceCount: 1,
      severity: 'CRITICAL',
      references: {
        links: [
          { url: 'https://www.rosario.gob.ar/inicio/habilitaciones', title: 'Portal de Habilitaciones Rosario' }
        ]
      },
      checklist: [
        { description: 'Completar formulario de solicitud', isRequired: true },
        { description: 'Adjuntar plano del local', isRequired: true },
        { description: 'Presentar comprobante de tasa municipal', isRequired: true },
        { description: 'Adjuntar certificado de bomberos vigente', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.comercio.tasa_seguridad_higiene',
      rubric: 'comercio',
      title: 'Tasa de Seguridad e Higiene (TSeH)',
      description: 'Tributo municipal mensual sobre la facturación del comercio',
      type: 'TAX',
      defaultPeriodicity: 'MONTHLY',
      defaultDueRule: 'Vence el día 15 de cada mes',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      checklist: [
        { description: 'Calcular base imponible del período', isRequired: true },
        { description: 'Generar boleta de pago', isRequired: true },
        { description: 'Realizar pago', isRequired: true },
        { description: 'Archivar comprobante', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.comercio.ingresos_brutos',
      rubric: 'comercio',
      title: 'Declaración Jurada Ingresos Brutos',
      description: 'Declaración mensual del impuesto provincial sobre ingresos brutos',
      type: 'DECLARATION',
      defaultPeriodicity: 'MONTHLY',
      defaultDueRule: 'Según terminación de CUIT',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      references: {
        links: [
          { url: 'https://www.santafe.gob.ar/api', title: 'API Santa Fe' }
        ]
      },
      checklist: [
        { description: 'Calcular base imponible', isRequired: true },
        { description: 'Completar declaración en sistema API', isRequired: true },
        { description: 'Generar VEP de pago', isRequired: true },
        { description: 'Abonar impuesto', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.comercio.seguro_responsabilidad_civil',
      rubric: 'comercio',
      title: 'Seguro de Responsabilidad Civil',
      description: 'Seguro que cubre daños a terceros en el local comercial',
      type: 'INSURANCE',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar antes de vencimiento de póliza',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'MEDIUM',
      checklist: [
        { description: 'Solicitar cotización', isRequired: true },
        { description: 'Revisar cobertura', isRequired: true },
        { description: 'Abonar prima', isRequired: true },
        { description: 'Archivar póliza', isRequired: true }
      ]
    }
  ];

  // Plantillas para Estética
  const esteticaTemplates: TemplateJson[] = [
    {
      templateKey: 'rosario.estetica.habilitacion_comercial',
      rubric: 'estetica',
      title: 'Habilitación Comercial Municipal',
      description: 'Habilitación municipal para centros de estética y spa',
      type: 'PERMIT',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar antes de vencimiento',
      requiresReview: true,
      requiredEvidenceCount: 1,
      severity: 'CRITICAL',
      checklist: [
        { description: 'Completar formulario de solicitud', isRequired: true },
        { description: 'Adjuntar plano del local', isRequired: true },
        { description: 'Presentar títulos habilitantes del personal', isRequired: true },
        { description: 'Adjuntar certificado de bomberos', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.estetica.registro_sanitario',
      rubric: 'estetica',
      title: 'Registro Sanitario Provincial',
      description: 'Inscripción en el registro sanitario provincial para establecimientos de estética',
      type: 'PERMIT',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar anualmente',
      requiresReview: true,
      requiredEvidenceCount: 1,
      severity: 'CRITICAL',
      checklist: [
        { description: 'Completar formulario de inscripción', isRequired: true },
        { description: 'Presentar títulos del personal profesional', isRequired: true },
        { description: 'Adjuntar protocolo de bioseguridad', isRequired: true },
        { description: 'Presentar constancia de disposición de residuos patogénicos', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.estetica.tasa_seguridad_higiene',
      rubric: 'estetica',
      title: 'Tasa de Seguridad e Higiene (TSeH)',
      description: 'Tributo municipal mensual',
      type: 'TAX',
      defaultPeriodicity: 'MONTHLY',
      defaultDueRule: 'Vence el día 15 de cada mes',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      checklist: [
        { description: 'Calcular base imponible', isRequired: true },
        { description: 'Generar boleta', isRequired: true },
        { description: 'Realizar pago', isRequired: true },
        { description: 'Archivar comprobante', isRequired: true }
      ]
    },
    {
      templateKey: 'rosario.estetica.disposicion_residuos',
      rubric: 'estetica',
      title: 'Contrato Disposición de Residuos Patogénicos',
      description: 'Contrato con empresa habilitada para el retiro de residuos patogénicos',
      type: 'PERMIT',
      defaultPeriodicity: 'ANNUAL',
      defaultDueRule: 'Renovar contrato anualmente',
      requiresReview: false,
      requiredEvidenceCount: 1,
      severity: 'HIGH',
      checklist: [
        { description: 'Contactar empresa habilitada', isRequired: true },
        { description: 'Firmar contrato de servicio', isRequired: true },
        { description: 'Verificar frecuencia de retiro', isRequired: true },
        { description: 'Mantener manifiestos de retiro', isRequired: true }
      ]
    }
  ];

  // Insertar todas las plantillas
  const allTemplates = [...gastronomiaTemplates, ...comercioTemplates, ...esteticaTemplates];

  for (const template of allTemplates) {
    await upsertTemplate(rosario.id, template);
  }

  console.log(`✅ ${allTemplates.length} templates seeded for Rosario`);
}

async function assignRosarioToExistingOrganizations() {
  console.log('🔄 Assigning Rosario to existing organizations...');

  const rosario = await prisma.jurisdiction.findUnique({
    where: { code: 'ar-sf-rosario' },
  });

  if (!rosario) return;

  const result = await prisma.organization.updateMany({
    where: { jurisdictionId: null },
    data: { jurisdictionId: rosario.id },
  });

  console.log(`✅ ${result.count} organizations assigned to Rosario`);
}

async function main() {
  console.log('🌱 Starting seed...\n');

  try {
    // 1. Crear jurisdicciones
    await seedJurisdictions();

    // 2. Intentar cargar plantillas desde archivos JSON
    await loadTemplatesFromJson();

    // 3. Si no hay plantillas cargadas, usar las por defecto
    const templateCount = await prisma.obligationTemplate.count();
    if (templateCount === 0) {
      await seedRosarioTemplates();
    }

    // 4. Asignar Rosario a organizaciones existentes
    await assignRosarioToExistingOrganizations();

    console.log('\n✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
