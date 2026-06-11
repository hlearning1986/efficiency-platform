'use client';

/**
 * TeamCards - 团队卡片列表组件
 * 完全匹配原型图设计规范
 *
 * 特点：
 * - 网格布局（每行2个卡片）
 * - 点击卡片头部切换展开/折叠状态
 * - 展开后显示该团队下各项目的角色饱和度条形图
 * - 每个团队显示迷你圆环 + 饱和度进度条
 */

import React from 'react';
import MiniGaugeRing from './shared/MiniGaugeRing';
import SaturationBar from './shared/SaturationBar';
import type { TeamOverview } from '../types/workload.types';
import {
  COLORS,
  ROLE_COLORS,
  ROLE_LABELS,
  getSaturationColor,
} from '../utils/design-tokens';

interface TeamCardsProps {
  /** 团队列表数据 */
  teams: TeamOverview[];
  /** 已展开的团队ID集合 */
  expandedTeams: Set<string>;
  /** 展开/折叠切换回调 */
  onToggle: (teamId: string) => void;
}

/** 团队颜色映射（根据索引循环） */
const TEAM_BADGE_COLORS = [
  '#1677ff', // 蓝
  '#722ed1', // 紫
  '#13c2c2', // 青
  '#eb2f96', // 粉
  '#fa8c16', // 橙
  '#52c41a', // 绿
];

const TeamCards: React.FC<TeamCardsProps> = ({
  teams,
  expandedTeams,
  onToggle,
}) => {
  return (
    <div className="team-cards-grid" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
      gap: '20px',
      marginBottom: '32px',
    }}>
      {teams.map((team, idx) => {
        const tid = team.teamId || team.id || `team-${idx}`;
        const isExpanded = expandedTeams.has(tid);
        const badgeColor = TEAM_BADGE_COLORS[idx % TEAM_BADGE_COLORS.length];

        return (
          <div
            key={tid}
            className={`team-card ${isExpanded ? 'expanded' : ''}`}
            style={{
              background: COLORS.bgCard,
              borderRadius: '16px',
              border: `1px solid ${isExpanded ? COLORS.primary : COLORS.borderLight}`,
              overflow: 'hidden',
              boxShadow: isExpanded ? '0 16px 48px rgba(0,0,0,.12)' : '0 1px 4px rgba(0,0,0,.05)',
              transition: 'all .3s ease',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {/* ===== 卡片头部 ===== */}
            <div
              className="team-card-header"
              onClick={() => onToggle(tid)}
              style={{
                padding: '22px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: isExpanded ? `1px solid ${COLORS.borderLight}` : '1px solid transparent',
                background: isExpanded ? COLORS.primaryLight : 'transparent',
                transition: 'all .25s ease',
              }}
            >
              {/* 左侧：团队徽章 + 信息 */}
              <div className="team-header-left" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}>
                {/* 团队徽章 */}
                <div className="team-badge" style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '17px',
                  fontWeight: 800,
                  color: 'white',
                  flexShrink: 0,
                  background: `linear-gradient(135deg, ${badgeColor}, ${badgeColor}dd)`,
                }}>
                  {(team.teamName || team.name || '').charAt(0)}
                </div>

                {/* 团队信息 */}
                <div>
                  <div className="team-name" style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                  }}>
                    {team.teamName || team.name}
                  </div>
                  <div className="team-meta" style={{
                    fontSize: '12px',
                    color: COLORS.textTertiary,
                    marginTop: '2px',
                  }}>
                    <strong style={{ color: COLORS.textSecondary, fontWeight: 600 }}>
                      {team.peopleCount}
                    </strong> 人 ·{' '}
                    <strong style={{ color: COLORS.textSecondary, fontWeight: 600 }}>
                      {Array.isArray(team.projects) ? team.projects.length : (Array.isArray(team.projectName) ? team.projectName.length : 0)}
                    </strong> 个TAPD项目
                  </div>
                </div>
              </div>

              {/* 右侧：迷你圆环 + 展开箭头 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MiniGaugeRing value={team.saturation} size={60} strokeWidth={5} showLabel={false} />

                <div className="expand-arrow" style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isExpanded ? 'white' : COLORS.textTertiary,
                  transition: 'all .3s ease',
                  background: isExpanded ? COLORS.primary : COLORS.bgBase,
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>
                  ▶
                </div>
              </div>
            </div>

            {/* ===== 展开内容：项目角色条形图 ===== */}
            <div
              className="team-card-body"
              style={{
                maxHeight: isExpanded ? '1500px' : '0',
                overflow: 'hidden',
                transition: 'max-height .5s cubic-bezier(.4,0,.2,1)',
              }}
            >
              <div className="card-body-inner" style={{ padding: '20px 24px' }}>
                {/* 子区域标签 */}
                <div className="sub-section-label" style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: COLORS.textTertiary,
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  TAPD 项目饱和度 & 角色分布
                  <span style={{
                    flex: 1,
                    height: '1px',
                    background: COLORS.borderLight,
                  }} />
                </div>

                {/* 项目列表 */}
                {team.projects && team.projects.length > 0 && (
                  <div className="project-list">
                    {team.projects.map((project, pIdx) => (
                      <div key={project.id || project.projectId || `p-${pIdx}`} className="project-item" style={{
                        background: COLORS.bgBase,
                        borderRadius: '12px',
                        padding: '16px 18px',
                        marginBottom: '12px',
                        border: '1px solid transparent',
                        transition: 'all .2s',
                      }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = COLORS.border;
                          e.currentTarget.style.background = COLORS.bgCard;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.background = COLORS.bgBase;
                        }}
                      >
                        {/* 项目头部 */}
                        <div className="proj-head" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '14px',
                      }}>
                        <div className="proj-name" style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          {/* 项目名称（适配后端 ProjAggResult 数据结构） */}
                          <span style={{
                            color: project.projectName && !project.projectName.includes('未分配') && !project.projectName.includes('未知') && !project.projectName.startsWith('项目')
                              ? COLORS.textPrimary
                              : COLORS.textTertiary,
                          }}>
                            {project.projectName && !project.projectName.includes('未分配') && !project.projectName.includes('未知') && !project.projectName.startsWith('项目')
                              ? project.projectName
                              : `项目 ${project.projectId?.slice(-6) || '?'}`
                            }
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: `${COLORS.primary}15`,
                            color: COLORS.primary,
                            border: `1px solid ${COLORS.primary}30`,
                          }}>
                            TAPD
                          </span>
                        </div>

                        <div className="proj-sat-badge" style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: 700,
                          background: `${getSaturationColor(project.saturation)}15`,
                          color: getSaturationColor(project.saturation),
                          border: `1px solid ${getSaturationColor(project.saturation)}30`,
                        }}>
                          {Math.round(project.saturation)}%
                        </div>
                      </div>

                        {/* 角色饱和度条形图列表 */}
                        {project.roles && project.roles.length > 0 && (
                          <div className="role-bars-list" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                          }}>
                            {project.roles.map((role, rIdx) => (
                              <div key={role.role || `r-${rIdx}`} className="role-bar-row" style={{
                                display: 'grid',
                                gridTemplateColumns: '110px 1fr 56px 50px',
                                alignItems: 'center',
                                gap: '12px',
                              }}>
                                {/* 角色名称 */}
                                <div className="role-name-cell" style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '7px',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: COLORS.textPrimary,
                                }}>
                                  <span className="role-dot" style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    background: ROLE_COLORS[role.role as keyof typeof ROLE_COLORS] || COLORS.primary,
                                  }} />
                                  {ROLE_LABELS[role.role as keyof typeof ROLE_LABELS] || role.role}
                                </div>

                                {/* 饱和度进度条（带阈值线） */}
                                <div className="role-track" style={{
                                  height: '24px',
                                  background: '#f0f2f5',
                                  borderRadius: '12px',
                                  overflow: 'hidden',
                                  position: 'relative',
                                }}>
                                  {/* 阈值线：70% 警告线 */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '70%',
                                    top: '0',
                                    bottom: '0',
                                    width: '1px',
                                    background: '#faad14',
                                    opacity: 0.5,
                                    zIndex: 1,
                                  }} />

                                  {/* 阈值线：85% 危险线 */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '85%',
                                    top: '0',
                                    bottom: '0',
                                    width: '1px',
                                    background: '#ff4d4f',
                                    opacity: 0.5,
                                    zIndex: 1,
                                  }} />

                                  <SaturationBar
                                    value={role.saturation}
                                    height={24}
                                    showLabel={true}
                                  />
                                </div>

                                {/* 工时信息 */}
                                <span style={{
                                  fontSize: '12px',
                                  color: COLORS.textTertiary,
                                  textAlign: 'right',
                                }}>
                                  {role.hours}/{role.cap}h
                                </span>

                                {/* 占位（保持布局一致） */}
                                <span />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 无项目数据提示 */}
                {(!team.projects || team.projects.length === 0) && (
                  <div style={{
                    textAlign: 'center',
                    padding: '30px 0',
                    color: COLORS.textTertiary,
                    fontSize: '13px',
                  }}>
                    暂无项目数据
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TeamCards;
