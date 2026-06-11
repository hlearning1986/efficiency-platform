'use client';

/**
 * PersonCardList - 人员卡片列表组件
 * 以网格形式展示人员饱和度信息，支持分页
 *
 * 特点：
 * - 卡片式布局，每行3-4个
 * - 显示头像、姓名、团队、角色、饱和度等信息
 * - 点击卡片打开详情面板
 */

import React from 'react';
import { Card, Row, Col, Tag, Pagination, Avatar } from 'antd';
import SaturationBar from './shared/SaturationBar';
import type { PersonCard } from '../types/workload.types';
import {
  ROLE_COLORS,
  ROLE_LABELS,
} from '../utils/saturation';

interface PersonCardListProps {
  /** 人员列表数据 */
  persons: PersonCard[];
  /** 总人数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 页码变更回调 */
  onPageChange: (page: number) => void;
  /** 人员点击回调 */
  onPersonClick: (name: string) => void;
}

const PersonCardList: React.FC<PersonCardListProps> = ({
  persons,
  total,
  page,
  pageSize,
  onPageChange,
  onPersonClick,
}) => {
  return (
    <div>
      {/* ===== 人员卡片网格 ===== */}
      <Row gutter={[16, 16]}>
        {persons.map((person) => (
          <Col key={person.name} xs={24} sm={12} md={8} lg={6}>
            <Card
              size="small"
              hoverable
              className="h-full cursor-pointer"
              onClick={() => onPersonClick(person.name)}
            >
              {/* 头部：头像 + 姓名 */}
              <div className="flex items-center gap-2 mb-2">
                <Avatar
                  size={36}
                  style={{ backgroundColor: person.avatar }}
                >
                  {person.name.charAt(0)}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{person.name}</div>
                  <div className="text-xs text-gray-400">{person.team}</div>
                </div>
              </div>

              {/* 角色标签 */}
              <Tag color={ROLE_COLORS[person.role]} style={{ marginBottom: 4 }}>
                {ROLE_LABELS[person.role]}
              </Tag>

              {/* 饱和度进度条 */}
              <SaturationBar value={person.sat} height={4} showLabel={false} />

              {/* 底部统计信息 */}
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{person.actual}h/{person.cap}h</span>
                <span>{Math.round(person.sat)}%</span>
              </div>

              {/* 借调状态标签 */}
              {person.loanStatus && (
                <Tag color="warning" size="small" className="mt-1">
                  {person.loanStatus}
                </Tag>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* ===== 分页器 ===== */}
      <div className="mt-4 flex justify-end">
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={onPageChange}
          showSizeChanger={false}
          showTotal={(total) => `共 ${total} 人`}
        />
      </div>
    </div>
  );
};

export default PersonCardList;
