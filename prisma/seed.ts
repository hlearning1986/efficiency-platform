import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

// ============================================================
// Mock 项目数据
// ============================================================

const strategicProjects = [
  {
    name: '上岸鸭',
    code: 'STR-001',
    category: 'STRATEGIC',
    okrName: 'O1-提升公考培训市场占有率',
    partner: '张伟',
    po: '李明',
    status: 'IN_PROGRESS',
    health: 'HEALTHY',
    progress: 72,
    priority: 'CRITICAL',
    budget: 2000000,
    milestones: [
      { quarter: 'Q1', target: '完成产品MVP，上线核心题库功能', achievement: '完成MVP开发，题库覆盖行测5大模块', progress: 90, sortOrder: 1 },
      { quarter: 'Q2', target: '用户量突破5万，上线AI智能刷题', achievement: '用户达4.2万，AI刷题功能上线', progress: 85, sortOrder: 2 },
      { quarter: 'Q3', target: '上线面试模拟系统，付费转化率达8%', achievement: '面试系统开发中，付费转化率5.6%', progress: 65, sortOrder: 3 },
      { quarter: 'Q4', target: '用户量突破20万，月营收超100万', achievement: '进行中', progress: 30, sortOrder: 4 },
    ],
    costs: [
      { quarter: 'Q1', laborCost: 180000, infraCost: 30000, externalCost: 50000, totalCost: 260000, target: '完成MVP开发' },
      { quarter: 'Q2', laborCost: 200000, infraCost: 45000, externalCost: 60000, totalCost: 305000, target: '用户增长与AI功能' },
      { quarter: 'Q3', laborCost: 220000, infraCost: 55000, externalCost: 40000, totalCost: 315000, target: '面试系统与商业化' },
      { quarter: 'Q4', laborCost: 250000, infraCost: 70000, externalCost: 80000, totalCost: 400000, target: '规模化增长' },
    ],
    rois: [
      { quarter: 'Q1', revenue: 50000, costSaving: 0, efficiencyGain: 20000, totalBenefit: 70000, totalCost: 260000, roiPercent: -73.1, targetRoi: -50 },
      { quarter: 'Q2', revenue: 150000, costSaving: 10000, efficiencyGain: 30000, totalBenefit: 190000, totalCost: 305000, roiPercent: -37.7, targetRoi: -20 },
      { quarter: 'Q3', revenue: 280000, costSaving: 20000, efficiencyGain: 50000, totalBenefit: 350000, totalCost: 315000, roiPercent: 11.1, targetRoi: 0 },
      { quarter: 'Q4', revenue: 500000, costSaving: 30000, efficiencyGain: 80000, totalBenefit: 610000, totalCost: 400000, roiPercent: 52.5, targetRoi: 30 },
    ],
  },
  {
    name: '大学生第三空间',
    code: 'STR-002',
    category: 'STRATEGIC',
    okrName: 'O2-打造大学生一站式服务平台',
    partner: '王芳',
    po: '赵强',
    status: 'IN_PROGRESS',
    health: 'HEALTHY',
    progress: 58,
    priority: 'HIGH',
    budget: 1500000,
    milestones: [
      { quarter: 'Q1', target: '完成平台架构设计，上线校园资讯模块', achievement: '架构设计完成，资讯模块上线', progress: 95, sortOrder: 1 },
      { quarter: 'Q2', target: '上线社团管理、活动报名功能', achievement: '社团管理上线，活动报名功能完成', progress: 80, sortOrder: 2 },
      { quarter: 'Q3', target: '覆盖50所高校，日活突破2万', achievement: '覆盖32所高校，日活1.5万', progress: 55, sortOrder: 3 },
      { quarter: 'Q4', target: '上线校园电商模块，启动商业化', achievement: '规划中', progress: 10, sortOrder: 4 },
    ],
    costs: [
      { quarter: 'Q1', laborCost: 120000, infraCost: 20000, externalCost: 30000, totalCost: 170000, target: '平台基础建设' },
      { quarter: 'Q2', laborCost: 150000, infraCost: 30000, externalCost: 40000, totalCost: 220000, target: '功能扩展' },
      { quarter: 'Q3', laborCost: 160000, infraCost: 40000, externalCost: 50000, totalCost: 250000, target: '高校推广' },
      { quarter: 'Q4', laborCost: 180000, infraCost: 50000, externalCost: 60000, totalCost: 290000, target: '商业化探索' },
    ],
    rois: [
      { quarter: 'Q1', revenue: 0, costSaving: 10000, efficiencyGain: 5000, totalBenefit: 15000, totalCost: 170000, roiPercent: -91.2, targetRoi: -80 },
      { quarter: 'Q2', revenue: 20000, costSaving: 15000, efficiencyGain: 10000, totalBenefit: 45000, totalCost: 220000, roiPercent: -79.5, targetRoi: -60 },
      { quarter: 'Q3', revenue: 80000, costSaving: 20000, efficiencyGain: 20000, totalBenefit: 120000, totalCost: 250000, roiPercent: -52.0, targetRoi: -30 },
      { quarter: 'Q4', revenue: 200000, costSaving: 30000, efficiencyGain: 40000, totalBenefit: 270000, totalCost: 290000, roiPercent: -6.9, targetRoi: 0 },
    ],
  },
];

const regularProjects = [
  {
    name: '效率平台V2.0升级',
    code: 'REG-001',
    category: 'REGULAR',
    okrName: 'O3-提升研发效能数据可视化能力',
    partner: '刘洋',
    po: '陈静',
    status: 'IN_PROGRESS',
    health: 'HEALTHY',
    progress: 45,
    priority: 'HIGH',
    budget: 800000,
    milestones: [
      { quarter: 'Q1', target: '完成需求调研和技术选型', achievement: '完成调研报告，确定技术栈', progress: 100, sortOrder: 1 },
      { quarter: 'Q2', target: '完成核心模块开发（项目管理、效能分析）', achievement: '开发进行中，完成60%', progress: 60, sortOrder: 2 },
      { quarter: 'Q3', target: '集成TAPD数据源，实现自动化报表', achievement: '待开始', progress: 0, sortOrder: 3 },
      { quarter: 'Q4', target: '全量上线，培训推广', achievement: '待开始', progress: 0, sortOrder: 4 },
    ],
    costs: [
      { quarter: 'Q1', laborCost: 80000, infraCost: 10000, externalCost: 20000, totalCost: 110000, target: '需求调研与设计' },
      { quarter: 'Q2', laborCost: 150000, infraCost: 20000, externalCost: 30000, totalCost: 200000, target: '核心模块开发' },
      { quarter: 'Q3', laborCost: 180000, infraCost: 25000, externalCost: 35000, totalCost: 240000, target: '数据集成与测试' },
      { quarter: 'Q4', laborCost: 120000, infraCost: 30000, externalCost: 20000, totalCost: 170000, target: '上线部署与推广' },
    ],
    rois: [
      { quarter: 'Q1', revenue: 0, costSaving: 5000, efficiencyGain: 10000, totalBenefit: 15000, totalCost: 110000, roiPercent: -86.4, targetRoi: -70 },
      { quarter: 'Q2', revenue: 0, costSaving: 15000, efficiencyGain: 25000, totalBenefit: 40000, totalCost: 200000, roiPercent: -80.0, targetRoi: -50 },
      { quarter: 'Q3', revenue: 0, costSaving: 30000, efficiencyGain: 50000, totalBenefit: 80000, totalCost: 240000, roiPercent: -66.7, targetRoi: -30 },
      { quarter: 'Q4', revenue: 50000, costSaving: 40000, efficiencyGain: 80000, totalBenefit: 170000, totalCost: 170000, roiPercent: 0.0, targetRoi: 10 },
    ],
  },
  {
    name: '移动端APP重构',
    code: 'REG-002',
    category: 'REGULAR',
    okrName: 'O4-优化用户体验，提升移动端活跃度',
    partner: '孙丽',
    po: '周强',
    status: 'PLANNING',
    health: 'AT_RISK',
    progress: 15,
    priority: 'MEDIUM',
    budget: 600000,
    milestones: [
      { quarter: 'Q1', target: '完成竞品分析和UI设计', achievement: '设计稿评审中', progress: 70, sortOrder: 1 },
      { quarter: 'Q2', target: '完成核心页面开发', achievement: '待开始', progress: 0, sortOrder: 2 },
      { quarter: 'Q3', target: '性能优化和兼容性测试', achievement: '待开始', progress: 0, sortOrder: 3 },
      { quarter: 'Q4', target: '灰度发布和全量上线', achievement: '待开始', progress: 0, sortOrder: 4 },
    ],
    costs: [
      { quarter: 'Q1', laborCost: 60000, infraCost: 8000, externalCost: 15000, totalCost: 83000, target: '设计与原型' },
      { quarter: 'Q2', laborCost: 140000, infraCost: 15000, externalCost: 25000, totalCost: 180000, target: '前端开发' },
      { quarter: 'Q3', laborCost: 160000, infraCost: 20000, externalCost: 20000, totalCost: 200000, target: '测试与优化' },
      { quarter: 'Q4', laborCost: 90000, infraCost: 22000, externalCost: 25000, totalCost: 137000, target: '发布与运维' },
    ],
    rois: [
      { quarter: 'Q1', revenue: 0, costSaving: 0, efficiencyGain: 5000, totalBenefit: 5000, totalCost: 83000, roiPercent: -94.0, targetRoi: -90 },
      { quarter: 'Q2', revenue: 0, costSaving: 10000, efficiencyGain: 15000, totalBenefit: 25000, totalCost: 180000, roiPercent: -86.1, targetRoi: -70 },
      { quarter: 'Q3', revenue: 0, costSaving: 20000, efficiencyGain: 30000, totalBenefit: 50000, totalCost: 200000, roiPercent: -75.0, targetRoi: -50 },
      { quarter: 'Q4', revenue: 30000, costSaving: 30000, efficiencyGain: 40000, totalBenefit: 100000, totalCost: 137000, roiPercent: -27.0, targetRoi: 0 },
    ],
  },
  {
    name: '数据中台建设',
    code: 'REG-003',
    category: 'REGULAR',
    okrName: 'O5-构建统一数据服务能力',
    partner: '赵敏',
    po: '钱峰',
    status: 'IN_PROGRESS',
    health: 'AT_RISK',
    progress: 35,
    priority: 'CRITICAL',
    budget: 1200000,
    milestones: [
      { quarter: 'Q1', target: '完成数据仓库设计和ETL框架搭建', achievement: 'ETL框架已搭建，数据模型设计中', progress: 75, sortOrder: 1 },
      { quarter: 'Q2', target: '接入核心业务数据源（订单、用户、行为）', achievement: '部分接入完成', progress: 40, sortOrder: 2 },
      { quarter: 'Q3', target: '构建数据分析API和数据可视化大屏', achievement: '待开始', progress: 0, sortOrder: 3 },
      { quarter: 'Q4', target: '建立数据治理体系和数据质量监控', achievement: '待开始', progress: 0, sortOrder: 4 },
    ],
    costs: [
      { quarter: 'Q1', laborCost: 120000, infraCost: 50000, externalCost: 30000, totalCost: 200000, target: '基础设施搭建' },
      { quarter: 'Q2', laborCost: 200000, infraCost: 80000, externalCost: 50000, totalCost: 330000, target: '数据接入' },
      { quarter: 'Q3', laborCost: 250000, infraCost: 100000, externalCost: 40000, totalCost: 390000, target: '应用开发' },
      { quarter: 'Q4', laborCost: 150000, infraCost: 80000, externalCost: 50000, totalCost: 280000, target: '治理与运营' },
    ],
    rois: [
      { quarter: 'Q1', revenue: 0, costSaving: 20000, efficiencyGain: 30000, totalBenefit: 50000, totalCost: 200000, roiPercent: -75.0, targetRoi: -60 },
      { quarter: 'Q2', revenue: 0, costSaving: 50000, efficiencyGain: 80000, totalBenefit: 130000, totalCost: 330000, roiPercent: -60.6, targetRoi: -40 },
      { quarter: 'Q3', revenue: 100000, costSaving: 80000, efficiencyGain: 120000, totalBenefit: 300000, totalCost: 390000, roiPercent: -23.1, targetRoi: -10 },
      { quarter: 'Q4', revenue: 200000, costSaving: 100000, efficiencyGain: 150000, totalBenefit: 450000, totalCost: 280000, roiPercent: 60.7, targetRoi: 20 },
    ],
  },
];

const technicalProjects = [
  {
    name: '微服务架构升级',
    code: 'TECH-001',
    category: 'TECHNICAL',
    okrName: 'O6-提升系统可扩展性和稳定性',
    partner: '冯刚',
    po: '何琳',
    status: 'IN_PROGRESS',
    health: 'HEALTHY',
    progress: 55,
    priority: 'HIGH',
    budget: 950000,
    milestones: [
      { quarter: 'Q1', target: '完成微服务拆分方案设计和POC验证', achievement: '方案评审通过，POC验证成功', progress: 100, sortOrder: 1 },
      { quarter: 'Q2', target: '核心服务拆分（用户服务、订单服务）', achievement: '用户服务已完成，订单服务进行中', progress: 65, sortOrder: 2 },
      { quarter: 'Q3', target: '引入Service Mesh和服务治理', achievement: '待开始', progress: 0, sortOrder: 3 },
      { quarter: 'Q4', target: '完成全量迁移和旧系统下线', achievement: '待开始', progress: 0, sortOrder: 4 },
    ],
    costs: [
      { quarter: 'Q1', laborCost: 100000, infraCost: 30000, externalCost: 20000, totalCost: 150000, target: '架构设计与POC' },
      { quarter: 'Q2', laborCost: 200000, infraCost: 50000, externalCost: 30000, totalCost: 280000, target: '核心服务拆分' },
      { quarter: 'Q3', laborCost: 220000, infraCost: 60000, externalCost: 40000, totalCost: 320000, target: '服务治理实施' },
      { quarter: 'Q4', laborCost: 130000, infraCost: 40000, externalCost: 30000, totalCost: 200000, target: '迁移与下线' },
    ],
    rois: [
      { quarter: 'Q1', revenue: 0, costSaving: 10000, efficiencyGain: 20000, totalBenefit: 30000, totalCost: 150000, roiPercent: -80.0, targetRoi: -70 },
      { quarter: 'Q2', revenue: 0, costSaving: 30000, efficiencyGain: 50000, totalBenefit: 80000, totalCost: 280000, roiPercent: -71.4, targetRoi: -50 },
      { quarter: 'Q3', revenue: 0, costSaving: 50000, efficiencyGain: 80000, totalBenefit: 130000, totalCost: 320000, roiPercent: -59.4, targetRoi: -30 },
      { quarter: 'Q4', revenue: 80000, costSaving: 80000, efficiencyGain: 100000, totalBenefit: 260000, totalCost: 200000, roiPercent: 30.0, targetRoi: 15 },
    ],
  },
  {
    name: 'DevOps流水线优化',
    code: 'TECH-002',
    category: 'TECHNICAL',
    okrName: 'O7-提升交付效率和代码质量',
    partner: '曹磊',
    po: '谢娜',
    status: 'COMPLETED',
    health: 'HEALTHY',
    progress: 100,
    priority: 'MEDIUM',
    budget: 450000,
    milestones: [
      { quarter: 'Q1', target: '完善CI/CD流程，增加自动化测试覆盖率', achievement: 'CI/CD流程优化完成，单元测试覆盖率提升至70%', progress: 100, sortOrder: 1 },
      { quarter: 'Q2', target: '引入代码质量门禁和安全扫描', achievement: 'SonarQube集成完成，安全扫描自动化', progress: 100, sortOrder: 2 },
      { quarter: 'Q3', target: '优化容器化部署，降低发布时间', achievement: '发布时间从30分钟缩短至5分钟', progress: 100, sortOrder: 3 },
      { quarter: 'Q4', target: '建立监控告警体系，完善运维文档', achievement: 'Prometheus+Grafana监控上线，文档完善', progress: 100, sortOrder: 4 },
    ],
    costs: [
      { quarter: 'Q1', laborCost: 80000, infraCost: 20000, externalCost: 15000, totalCost: 115000, target: 'CI/CD优化' },
      { quarter: 'Q2', laborCost: 90000, infraCost: 25000, externalCost: 20000, totalCost: 135000, target: '质量门禁' },
      { quarter: 'Q3', laborCost: 85000, infraCost: 30000, externalCost: 15000, totalCost: 130000, target: '容器化' },
      { quarter: 'Q4', laborCost: 50000, infraCost: 20000, externalCost: 0, totalCost: 70000, target: '监控体系' },
    ],
    rois: [
      { quarter: 'Q1', revenue: 0, costSaving: 20000, efficiencyGain: 30000, totalBenefit: 50000, totalCost: 115000, roiPercent: -56.5, targetRoi: -50 },
      { quarter: 'Q2', revenue: 0, costSaving: 40000, efficiencyGain: 50000, totalBenefit: 90000, totalCost: 135000, roiPercent: -33.3, targetRoi: -20 },
      { quarter: 'Q3', revenue: 0, costSaving: 60000, efficiencyGain: 80000, totalBenefit: 140000, totalCost: 130000, roiPercent: 7.7, targetRoi: 5 },
      { quarter: 'Q4', revenue: 0, costSaving: 80000, efficiencyGain: 100000, totalBenefit: 180000, totalCost: 700000, roiPercent: 157.1, targetRoi: 50 },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  // 清理旧数据（按依赖顺序）
  await prisma.projectMilestone.deleteMany();
  await prisma.projectRoi.deleteMany();
  await prisma.projectCost.deleteMany();
  await prisma.projectOkr.deleteMany();
  await prisma.project.deleteMany();
  await prisma.efficiencyConfig.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.member.deleteMany();
  await prisma.team.deleteMany();
  await prisma.organization.deleteMany();

  // 1. 创建默认组织"研发中心"
  const org = await prisma.organization.create({
    data: {
      name: '研发中心',
      level: 'DEPARTMENT',
    },
  });
  console.log(`Created organization: ${org.name} (${org.id})`);

  // 2. 创建默认团队"平台研发组"
  const team = await prisma.team.create({
    data: {
      name: '平台研发组',
      orgId: org.id,
      techStack: JSON.stringify(['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL']),
    },
  });
  console.log(`Created team: ${team.name} (${team.id})`);

  // 3. 创建默认成员"系统管理员"
  const adminMember = await prisma.member.create({
    data: {
      name: '系统管理员',
      employeeNo: 'ADMIN001',
      teamId: team.id,
      role: 'MANAGER',
      level: 'P8',
      skills: JSON.stringify({
        languages: ['TypeScript', 'Python'],
        frameworks: ['React', 'Next.js', 'Node.js'],
        databases: ['PostgreSQL', 'Redis'],
        tools: ['Docker', 'Git', 'CI/CD'],
      }),
      status: 'ACTIVE',
    },
  });
  console.log(`Created member: ${adminMember.name} (${adminMember.id})`);

  // 4. 创建管理员账号
  const userAccount = await prisma.userAccount.create({
    data: {
      memberId: adminMember.id,
      email: 'admin@company.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`Created user account: ${userAccount.email} (${userAccount.id})`);

  // 5. 创建默认效能配置
  const configs = [
    {
      configType: 'WEIGHT',
      configKey: 'delivery_weight',
      configValue: JSON.stringify({ label: '交付效率权重', value: 0.3, description: '交付效率在总分中的权重' }),
    },
    {
      configType: 'WEIGHT',
      configKey: 'quality_weight',
      configValue: JSON.stringify({ label: '代码质量权重', value: 0.25, description: '代码质量在总分中的权重' }),
    },
    {
      configType: 'WEIGHT',
      configKey: 'completion_weight',
      configValue: JSON.stringify({ label: '完成率权重', value: 0.25, description: '需求完成率在总分中的权重' }),
    },
    {
      configType: 'WEIGHT',
      configKey: 'defect_weight',
      configValue: JSON.stringify({ label: '缺陷管理权重', value: 0.2, description: '缺陷管理在总分中的权重' }),
    },
    {
      configType: 'THRESHOLD',
      configKey: 'project_delay_alert_days',
      configValue: JSON.stringify({ label: '项目延期预警天数', value: 7, description: '项目延期超过此天数触发预警' }),
    },
    {
      configType: 'THRESHOLD',
      configKey: 'project_health_min_score',
      configValue: JSON.stringify({ label: '项目健康度最低分', value: 60, description: '项目健康度低于此分数标记为风险' }),
    },
  ];

  for (const config of configs) {
    const created = await prisma.efficiencyConfig.create({ data: config });
    console.log(`Created config: ${created.configKey}`);
  }

  // 6. 创建Mock项目数据
  const allProjects = [...strategicProjects, ...regularProjects, ...technicalProjects];

  for (const proj of allProjects) {
    const project = await prisma.project.create({
      data: {
        name: proj.name,
        code: proj.code,
        type: proj.category === 'STRATEGIC' ? 'STRATEGIC' : proj.category === 'REGULAR' ? 'REGULAR' : 'TECHNICAL',
        category: proj.category,
        status: proj.status,
        health: proj.health,
        progress: proj.progress,
        priority: proj.priority,
        budget: proj.budget,
        okrName: proj.okrName,
        partner: proj.partner,
        po: proj.po,
        teamId: team.id,
        ownerId: adminMember.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      },
    });
    console.log(`Created project: ${project.name} (${project.code})`);

    // 创建里程碑
    for (const ms of proj.milestones) {
      await prisma.projectMilestone.create({
        data: {
          projectId: project.id,
          quarter: ms.quarter,
          target: ms.target,
          achievement: ms.achievement,
          progress: ms.progress,
          sortOrder: ms.sortOrder,
        },
      });
    }

    // 创建成本
    for (const cost of proj.costs) {
      await prisma.projectCost.create({
        data: {
          projectId: project.id,
          quarter: cost.quarter,
          laborCost: cost.laborCost,
          infraCost: cost.infraCost,
          externalCost: cost.externalCost,
          totalCost: cost.totalCost,
          target: cost.target,
          dataSource: 'manual',
        },
      });
    }

    // 创建ROI
    for (const roi of proj.rois) {
      await prisma.projectRoi.create({
        data: {
          projectId: project.id,
          quarter: roi.quarter,
          revenue: roi.revenue,
          costSaving: roi.costSaving,
          efficiencyGain: roi.efficiencyGain,
          totalBenefit: roi.totalBenefit,
          totalCost: roi.totalCost,
          roiPercent: roi.roiPercent,
          targetRoi: roi.targetRoi,
        },
      });
    }
  }

  console.log(`\nCreated ${allProjects.length} projects total`);

  // 7. 创建 TAPD 工作空间测试数据
  const workspaces = [
    { id: 'ws001', name: '效率平台', status: 'active' },
    { id: 'ws002', name: '上岸鸭APP', status: 'active' },
    { id: 'ws003', name: '大学生第三空间', status: 'active' },
    { id: 'ws004', name: '移动端重构', status: 'active' },
    { id: 'ws005', name: '数据中台', status: 'active' },
  ];

  for (const ws of workspaces) {
    await prisma.tapdWorkspace.upsert({
      where: { id: ws.id },
      update: {},
      create: ws,
    });
  }
  console.log(`Created ${workspaces.length} TAPD workspaces`);

  // 8. 团队配置测试数据已移除
  // 现在系统会自动从TAPD API同步真实工作区数据到team_config表
  // 如需手动创建测试团队，请取消下面的注释
  /*
  const teamConfigNames = ['前端开发组', '后端开发组', '移动端开发组', '测试组'];
  await prisma.teamConfig.deleteMany({
    where: { name: { in: teamConfigNames } },
  });

  const teamConfigs = [
    {
      name: '前端开发组',
      tapdProjectIds: JSON.stringify(['ws001', 'ws003']),
      enableTeamRanking: true,
      enableHrRanking: true,
    },
    {
      name: '后端开发组',
      tapdProjectIds: JSON.stringify(['ws001', 'ws002', 'ws005']),
      enableTeamRanking: true,
      enableHrRanking: true,
    },
    {
      name: '移动端开发组',
      tapdProjectIds: JSON.stringify(['ws004']),
      enableTeamRanking: true,
      enableHrRanking: true,
    },
    {
      name: '测试组',
      tapdProjectIds: JSON.stringify(['ws001', 'ws002', 'ws003']),
      enableTeamRanking: true,
      enableHrRanking: true,
    },
  ];

  for (const tc of teamConfigs) {
    await prisma.teamConfig.create({ data: tc });
  }
  console.log(`Created ${teamConfigs.length} team configs`);
  */

  // 9. 创建成员角色映射测试数据
  const roleMappings = [
    { workspaceId: 'ws001', memberName: '张三', role: 'frontend' },
    { workspaceId: 'ws001', memberName: '李四', role: 'backend' },
    { workspaceId: 'ws001', memberName: '王五', role: 'test' },
    { workspaceId: 'ws002', memberName: '李四', role: 'backend' },
    { workspaceId: 'ws002', memberName: '赵六', role: 'test' },
    { workspaceId: 'ws003', memberName: '张三', role: 'frontend' },
    { workspaceId: 'ws004', memberName: '孙七', role: 'mobile' },
    { workspaceId: 'ws005', memberName: '周八', role: 'backend' },
  ];

  for (const rm of roleMappings) {
    await prisma.tapdMemberRoleMapping.upsert({
      where: {
        workspaceId_memberName_role: {
          workspaceId: rm.workspaceId,
          memberName: rm.memberName,
          role: rm.role,
        },
      },
      update: {},
      create: { ...rm, isActive: true },
    });
  }
  console.log(`Created ${roleMappings.length} role mappings`);

  // 10. 创建一些测试任务数据
  const testTasks = [
    // 前端任务 - 张三
    { workspaceId: 'ws001', name: '首页改版优化', owner: '张三', status: 'in_progress', effort: 16, effortCompleted: 8, begin: new Date('2026-06-01'), due: new Date('2026-06-10') },
    { workspaceId: 'ws001', name: '仪表盘组件开发', owner: '张三', status: 'todo', effort: 24, begin: new Date('2026-06-08'), due: new Date('2026-06-15') },
    { workspaceId: 'ws003', name: '校园资讯模块UI', owner: '张三', status: 'in_progress', effort: 20, effortCompleted: 12, begin: new Date('2026-05-25'), due: new Date('2026-06-07') },

    // 后端任务 - 李四
    { workspaceId: 'ws001', name: 'API接口优化', owner: '李四', status: 'done', effort: 32, effortCompleted: 32, begin: new Date('2026-05-20'), due: new Date('2026-05-28') },
    { workspaceId: 'ws001', name: '数据库性能调优', owner: '李四', status: 'in_progress', effort: 40, effortCompleted: 16, begin: new Date('2026-06-01'), due: new Date('2026-06-15') },
    { workspaceId: 'ws002', name: '题库服务开发', owner: '李四', status: 'in_progress', effort: 48, effortCompleted: 20, begin: new Date('2026-05-28'), due: new Date('2026-06-18') },

    // 测试任务 - 王五、赵六
    { workspaceId: 'ws001', name: '首页功能测试', owner: '王五', status: 'in_progress', effort: 8, effortCompleted: 4, begin: new Date('2026-06-03'), due: new Date('2026-06-09') },
    { workspaceId: 'ws002', name: '题库模块测试', owner: '赵六', status: 'todo', effort: 24, begin: new Date('2026-06-10'), due: new Date('2026-06-20') },
    { workspaceId: 'ws003', name: '资讯模块测试', owner: '王五', status: 'todo', effort: 16, begin: new Date('2026-06-10'), due: new Date('2026-06-17') },

    // 移动端任务 - 孙七
    { workspaceId: 'ws004', name: 'APP首页重构', owner: '孙七', status: 'in_progress', effort: 40, effortCompleted: 18, begin: new Date('2026-05-27'), due: new Date('2026-06-14') },
    { workspaceId: 'ws004', name: '列表页性能优化', owner: '孙七', status: 'todo', effort: 24, begin: new Date('2026-06-12'), due: new Date('2026-06-22') },

    // 数据中台 - 周八
    { workspaceId: 'ws005', name: 'ETL流程开发', owner: '周八', status: 'in_progress', effort: 56, effortCompleted: 24, begin: new Date('2026-05-22'), due: new Date('2026-06-19') },
  ];

  for (const task of testTasks) {
    await prisma.tapdStory.create({
      data: {
        id: `story-${Math.random().toString(36).substr(2, 9)}`,
        ...task,
        priority: 'high',
        created: new Date(),
        modified: new Date(),
      },
    });
  }
  console.log(`Created ${testTasks.length} test tasks`);

  console.log('\nSeeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });