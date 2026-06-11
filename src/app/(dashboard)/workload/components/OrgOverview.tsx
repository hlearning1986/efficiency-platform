'use client';

/**
 * OrgOverview - 组织概览区域组件
 * 完全匹配原型图设计规范
 *
 * 布局结构（左环右板）：
 * ┌─────────────────────────────────────────────┐
 * │ ┌──────────┐  ┌──────────────────────────┐  │
 * │ │          │  │  团队饱和度概览 (3列)    │  │
 * │ │ 组织圆环 │  ├──────────────────────────┤  │
 * │ │          │  │  角色端饱和度 (4列)      │  │
 * │ │ 统计数字 │  │                          │  │
 * │ └──────────┘  └──────────────────────────┘  │
 * └─────────────────────────────────────────────┘
 */

import React, { useState } from 'react';
import { GaugeRingWithCenter } from './shared/GaugeRing';
import MiniGaugeRing from './shared/MiniGaugeRing';
import RoleDetailModal from './RoleDetailModal';
import type { OrgOverview as OrgOverviewType, TeamOverview, RoleSummaryItem } from '../types/workload.types';
import type { PersonSatResult, WorkloadRole } from '../../app/api/v1/workload/_lib/types';
import {
  COLORS,
  ROLE_COLORS,
  ROLE_LABELS,
  getSaturationColor,
  getSaturationLabel,
} from '../utils/design-tokens';

interface OrgOverviewProps {
  /** 组织概览数据 */
  org: OrgOverviewType | null;
  /** 团队列表 */
  teams: TeamOverview[];
  /** 角色端汇总 */
  roleSummary: RoleSummaryItem[];
  /** 团队卡片点击回调 */
  onTeamClick?: (teamId: string) => void;
  /** 所有人员数据（用于角色详情弹窗） */
  allPersons?: PersonSatResult[];
}

const OrgOverview: React.FC<OrgOverviewProps> = ({
  org,
  teams,
  roleSummary,
  onTeamClick,
  allPersons = [],
}) => {
  // 角色详情弹窗状态
  const [selectedRole, setSelectedRole] = useState<WorkloadRole | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  /**
   * 处理角色卡片点击
   */
  const handleRoleCardClick = (role: WorkloadRole) => {
    setSelectedRole(role);
    setModalVisible(true);
  };

  /**
   * 关闭角色详情弹窗
   */
  const handleModalClose = () => {
    setModalVisible(false);
    // 延迟清除选中状态，让关闭动画完成
    setTimeout(() => setSelectedRole(null), 300);
  };

  // 数据加载中状态
  if (!org) {
    return (
      <div className="p-8 text-center" style={{ color: COLORS.textTertiary }}>
        加载中...
      </div>
    );
  }

  return (
    <section className="org-hero" style={{
      display: 'grid',
      gridTemplateColumns: '340px 1fr',
      gap: '24px',
      marginBottom: '28px',
    }}>
      {/* ===== 左侧：组织圆环仪表盘 ===== */}
      <div className="org-gauge-card" style={{
        background: COLORS.bgCard,
        borderRadius: '22px',
        border: `1px solid ${COLORS.borderLight}`,
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      }}>
        {/* 装饰性渐变背景 */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 70% 30%, rgba(22,119,255,.05) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        {/* 标签 */}
        <div className="gauge-label" style={{
          fontSize: '12px',
          fontWeight: 700,
          color: COLORS.textTertiary,
          letterSpacing: '1px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 1,
        }}>
          组织整体饱和度
        </div>

        {/* 圆环仪表盘 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <GaugeRingWithCenter
            value={org.saturation || 0}
            size={200}
            strokeWidth={16}
            customSubLabel="平均工时饱和度"
            useGradient={true}
            showValue={true}
            showUnit={true}
          />
        </div>

        {/* 底部统计数字 */}
        <div className="gauge-stats-row" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginTop: '24px',
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}>
          {[
            { label: '总人数', value: org.totalPeople, color: '#1677ff' },
            { label: '总容量', value: Math.round(org.totalCapacity), color: '#52c41a' },
            { label: '已用工时', value: Math.round(org.totalActual), color: '#fa8c16' },
          ].map((stat) => (
            <div key={stat.label} className="g-stat" style={{
              background: COLORS.bgBase,
              borderRadius: '10px',
              padding: '14px 10px',
              textAlign: 'center',
              transition: 'transform .2s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div className="g-stat-val" style={{
                fontSize: '22px',
                fontWeight: 800,
                lineHeight: 1.2,
                color: stat.color || COLORS.textPrimary,
              }}>
                {stat.value}
              </div>
              <div className="g-stat-lbl" style={{
                fontSize: '11px',
                color: COLORS.textTertiary,
                marginTop: '3px',
                fontWeight: 500,
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 右侧面板容器 ===== */}
      <div className="org-right-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* ===== 右侧上：团队饱和度概览 - 迷你圆环网格 ===== */}
        <div className="org-team-section" style={{
          background: COLORS.bgCard,
          borderRadius: '22px',
          border: `1px solid ${COLORS.borderLight}`,
          padding: '22px 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
        }}>
          {/* 标题栏 */}
          <div className="org-team-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
          }}>
            <div className="org-team-title" style={{
              fontSize: '15px',
              fontWeight: 700,
              color: COLORS.textPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span className="org-team-dot" style={{
                width: '4px',
                height: '18px',
                borderRadius: '2px',
                background: COLORS.primary,
              }} />
              各团队饱和度概览
            </div>
          </div>

          {/* 团队迷你圆环网格（3列） */}
          <div className="team-mini-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
          }}>
            {teams.map((team, idx) => {
              const tid = team.teamId || team.id || `team-${idx}`;
              return (
                <div
                  key={tid}
                  className="team-ring-card"
                  onClick={() => onTeamClick?.(tid)}
                  style={{
                    background: 'linear-gradient(145deg, #fafbfc, #f5f7fa)',
                    borderRadius: '14px',
                    padding: '16px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all .3s ease',
                    border: '1.5px solid transparent',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.08)';
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <MiniGaugeRing
                    value={team.saturation}
                    size={64}
                    strokeWidth={6}
                    showLabel={false}
                  />
                  <div className="trg-name" style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                    marginBottom: '2px',
                    marginTop: '8px',
                  }}>
                    {team.teamName || team.name}
                  </div>
                  <div className="trg-meta" style={{
                    fontSize: '10.5px',
                    color: COLORS.textTertiary,
                    letterSpacing: '.2px',
                  }}>
                    {team.peopleCount}人 | {team.actualHours}h/{team.capacityHours}h
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== 右侧下：角色端饱和度 - 大号圆环组 ===== */}
        <div className="org-role-section" style={{
          background: COLORS.bgCard,
          borderRadius: '22px',
          border: `1px solid ${COLORS.borderLight}`,
          padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,.05)',
        }}>
          {/* 标题栏 */}
          <div className="org-role-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            <div className="org-role-title" style={{
              fontSize: '15px',
              fontWeight: 700,
              color: COLORS.textPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span className="org-role-dot" style={{
                width: '4px',
                height: '18px',
                borderRadius: '2px',
                background: '#722ed1',
              }} />
              角色端饱和度
            </div>
          </div>

          {/* 角色大圆环横排（4列） */}
          <div className="org-role-rings" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
          }}>
            {roleSummary.map((role, idx) => {
              const roleKey = role.role || `role-${idx}`;
              const gradientMap = {
                frontend: 'linear-gradient(160deg, #f9f0ff, #f3e8ff)',
                backend: 'linear-gradient(160deg, #e6f4ff, #e0efff)',
                mobile: 'linear-gradient(160deg, #e6fffb, #dff7f5)',
                test: 'linear-gradient(160deg, #fff0f6, #ffe8f2)',
              };

              return (
                <div
                  key={roleKey}
                  className={`role-gauge-card ${role.role}`}
                  style={{
                    textAlign: 'center',
                    padding: '20px 14px 16px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    transition: 'all .3s ease',
                    position: 'relative',
                    background: gradientMap[role.role as keyof typeof gradientMap] || gradientMap.frontend,
                  }}
                  onClick={() => handleRoleCardClick(role.role as WorkloadRole)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* 角色组圆环 */}
                  <GaugeRingWithCenter
                    value={role.saturation || 0}
                    size={100}
                    strokeWidth={8}
                    useRoleBg={true}
                    showValue={true}
                    showUnit={true}
                    customSubLabel=""
                  />

                  {/* 角色组名称 */}
                  <div className="rgc-name" style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    marginTop: '8px',
                    marginBottom: '6px',
                    color: COLORS.textPrimary,
                  }}>
                    {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS] || role.roleName || role.role || '未知角色'}
                  </div>

                  {/* 人数 + 工时详情（同行显示） */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '11px',
                    color: COLORS.textSecondary,
                  }}>
                    {/* 人数 */}
                    <span style={{
                      fontWeight: 600,
                      color: COLORS.primary,
                      whiteSpace: 'nowrap',
                    }}>
                      {role.peopleCount || 0}人
                    </span>

                    {/* 分隔符 */}
                    <span style={{ color: '#e0e0e0' }}>|</span>

                    {/* 工时数据 */}
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{Math.round(role.totalHours || 0)}h</span>
                      <span style={{ color: '#d9d9d9', margin: '0 2px' }}>/</span>
                      <span style={{ fontWeight: 600 }}>{Math.round(role.totalCap || 0)}h</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 角色详情弹窗 */}
      <RoleDetailModal
        visible={modalVisible}
        onClose={handleModalClose}
        role={selectedRole}
        persons={allPersons}
      />
    </section>
  );
};

export default OrgOverview;
