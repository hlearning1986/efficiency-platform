'use client';

import React from 'react';
import {
  DashboardOutlined,
  ProjectOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  SettingOutlined,
  FundOutlined,
  EditOutlined,
  UnorderedListOutlined,
  DollarOutlined,
  FileTextOutlined,
  TrophyOutlined,
  UserOutlined,
  ControlOutlined,
  ClockCircleOutlined,
  ApartmentOutlined,
  PieChartOutlined,
  SyncOutlined,
  ApiOutlined,
  SafetyOutlined,
  AuditOutlined,
  LinkOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
): MenuItem {
  return { key, icon, children, label } as MenuItem;
}

export const sidebarMenuItems: MenuItem[] = [
  getItem('效能大盘', '/', <DashboardOutlined />),
  getItem('项目管理', '/projects', <ProjectOutlined />, [
    getItem('项目列表', '/projects/list', <UnorderedListOutlined />),
    getItem('项目管理', '/projects/manage', <EditOutlined />),
    getItem('成本分析', '/projects/analysis', <DollarOutlined />),
    getItem('执行摘要', '/projects/summary', <FileTextOutlined />),
  ]),
  getItem('效能看板', '/dashboard', <ThunderboltOutlined />, [
    getItem('需求交付大盘', '/dashboard/delivery-dashboard', <FundOutlined />),
    getItem('效能排名', '/efficiency/rankings', <TrophyOutlined />),
    getItem('人员评比', '/efficiency/members', <UserOutlined />),
    getItem('效能配置', '/efficiency/config', <ControlOutlined />),
  ]),
  getItem('敏捷管理', '/agile', <TeamOutlined />, [
    getItem('迭代管理', '/agile/sprints', <ApartmentOutlined />),
    getItem('需求进度', '/agile/requirements', <ClockCircleOutlined />),
    getItem('工时管理', '/agile/work-hours', <PieChartOutlined />),
  ]),
  getItem('资源管理', '/resources', <TeamOutlined />, [
    getItem('人力分布', '/resources/distribution', <PieChartOutlined />),
    getItem('人力负荷', '/resources/workload', <FundOutlined />),
    getItem('数据同步', '/resources/sync', <SyncOutlined />),
  ]),
  getItem('系统设置', '/settings', <SettingOutlined />, [
    getItem('TAPD 配置', '/settings/tapd', <ApiOutlined />),
    getItem('TAPD 数据管理', '/tapd/data-manager', <DatabaseOutlined />),
    getItem('团队配置', '/settings/team-config', <TeamOutlined />),
    getItem('项目归属映射', '/settings/project-mapping', <LinkOutlined />),
    getItem('用户管理', '/settings/users', <SafetyOutlined />),
    getItem('审计日志', '/settings/audit-log', <AuditOutlined />),
  ]),
];
