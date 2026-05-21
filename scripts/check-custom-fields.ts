import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 检查所有自定义字段的值 ===\n');
  
  const story = await prisma.tapdStory.findFirst({
    where: { rawJson: { not: null } },
    orderBy: { created: 'desc' },
    select: { id: true, name: true, rawJson: true },
  });
  
  if (!story?.rawJson) {
    console.log('❌ 没有找到数据');
    return;
  }
  
  const rawData = story.rawJson as Record<string, unknown>;
  
  console.log(`需求: ${story.name}`);
  console.log(`ID: ${story.id}\n`);
  
  const fieldsToCheck = [
    'module', 'feature',
    'custom_field_one', 'custom_field_two', 'custom_field_three',
    'custom_field_four', 'custom_field_five', 'custom_field_six',
    'custom_field_seven', 'custom_field_eight',
    'custom_field_9', 'custom_field_10', 'custom_field_11',
    'custom_field_12', 'custom_field_13', 'custom_field_14', 'custom_field_15',
    'custom_field_16', 'custom_field_17', 'custom_field_18', 'custom_field_19', 'custom_field_20',
    'custom_field_21', 'custom_field_22', 'custom_field_23', 'custom_field_24', 'custom_field_25',
  ];
  
  console.log('=== 所有字段值检查 ===');
  for (const field of fieldsToCheck) {
    const value = rawData[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      console.log(`✅ ${field}: "${value}"`);
    }
  }
  
  const allStories = await prisma.tapdStory.findMany({
    where: { rawJson: { not: null } },
    take: 10,
    select: { rawJson: true }
  });
  
  const fieldCounts: Record<string, number> = {};
  
  for (const s of allStories) {
    if (!s.rawJson) continue;
    const data = s.rawJson as Record<string, unknown>;
    
    for (const field of fieldsToCheck) {
      const val = data[field];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      }
    }
  }
  
  const sortedFields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1]);
  
  console.log('\n\n=== 统计各字段填充率 ===');
  for (const [field, count] of sortedFields) {
    const percentage = (count / allStories.length * 100).toFixed(0);
    const paddedField = field.padEnd(25);
    const paddedCount = String(count).padStart(2);
    console.log(`${paddedField} ${paddedCount} / ${allStories.length} (${percentage}%)`);
  }
  
  console.log('\n\n=== 有值的字段示例 ===');
  for (let i = 0; i < Math.min(sortedFields.length, 10); i++) {
    const entry = sortedFields[i];
    const field = entry[0];
    const count = entry[1];
    
    if (count > 0) {
      let found = false;
      for (const s of allStories) {
        if (found || !s.rawJson) continue;
        const data = s.rawJson as Record<string, unknown>;
        const val = data[field];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          console.log(`\n${field}: "${val}"`);
          found = true;
        }
      }
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);