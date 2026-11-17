-- 「留不留」Vectoree 真实 schema 迁移 —— 阶段一（可安全执行）
-- 目标项目: 6f60cc06-7bdd-4a45-91ea-e8d12723ac7b
-- 真实业务 schema: p_6f60cc067bdd4a4591eae8d12723ac7b_app（不是 public）
--
-- 用法：把整段复制到 Vectoree 控制台的 SQL 里，一次性执行（脚本依赖单个会话）。
-- 全部是加法操作，可重复执行。
--
-- 为什么只做阶段一：
--   现有 votes/opinions 的历史行 post_id = 'camel-coat'（演示值，非 uuid），
--   而 posts.id 是 uuid。因此「指向 posts(id) 的外键」和「守卫触发器里 id = NEW.post_id」
--   会因 text/uuid 类型不匹配报错。等演示数据清理、post_id 统一为 uuid 后，
--   再把 prepare-close-outfit-schema.sql 里改写后的外键 / 触发器 / RLS 作为阶段二执行。
--
-- 本阶段：加列、price 规范化、reports 表、唯一/部分索引、CHECK 约束（NOT VALID）。

BEGIN;
SET LOCAL search_path TO p_6f60cc067bdd4a4591eae8d12723ac7b_app;

-- 1) posts 新增列（前端已按这些字段读取，缺失时按默认值兜底）
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS desired_effect text,
  ADD COLUMN IF NOT EXISTS return_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS return_deadline date,
  ADD COLUMN IF NOT EXISTS votes_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_cleanup_pending boolean NOT NULL DEFAULT false;

-- 2) price: integer -> numeric(8,2)。整数值转换必然无损，无需人工核对历史数据。
ALTER TABLE posts ALTER COLUMN price TYPE numeric(8,2) USING price::numeric(8,2);

-- 3) opinions 新增列
ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS parent_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- 4) reports 表（阶段一先不加外键；BFF 写入 id/user_id/post_id/opinion_id/reason/status）
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  opinion_id uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) 索引
CREATE UNIQUE INDEX IF NOT EXISTS reports_pending_post_unique
  ON reports(user_id, post_id) WHERE status = 'pending' AND opinion_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_pending_opinion_unique
  ON reports(user_id, post_id, opinion_id) WHERE status = 'pending' AND opinion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS votes_user_post_unique ON votes(user_id, post_id);
CREATE UNIQUE INDEX IF NOT EXISTS post_images_position_unique ON post_images(post_id, position);
CREATE INDEX IF NOT EXISTS opinions_parent_idx ON opinions(parent_id);
CREATE INDEX IF NOT EXISTS posts_visible_created_idx ON posts(created_at, id)
  WHERE deleted_at IS NULL AND hidden_at IS NULL AND status = 'published' AND NOT is_demo;

-- 6) CHECK 约束（NOT VALID：只约束新写入，不追溯历史行）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_return_check' AND conrelid = 'posts'::regclass) THEN
    ALTER TABLE posts ADD CONSTRAINT close_outfit_return_check CHECK (
      return_status IN ('known', 'unknown', 'unavailable') AND
      ((return_status = 'known' AND return_deadline IS NOT NULL) OR
       (return_status <> 'known' AND return_deadline IS NULL))
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_fields_check' AND conrelid = 'posts'::regclass) THEN
    ALTER TABLE posts ADD CONSTRAINT close_outfit_fields_check CHECK (
      char_length(coalesce(brand, '')) <= 30 AND char_length(coalesce(desired_effect, '')) <= 120 AND
      char_length(coalesce(decision_reason, '')) <= 180 AND
      (price IS NULL OR price BETWEEN 0 AND 999999.99) AND
      status IN ('publishing', 'published', 'hidden', 'deleted')
    ) NOT VALID;
  END IF;
END $$;

COMMIT;

-- 阶段二（暂不执行，待演示数据清理后）：
--   1. 把 votes/opinions.post_id 统一为 uuid 并清掉 'camel-coat' 演示行。
--   2. 补 posts/opinions/post_images 的外键（NOT VALID）。
--   3. 建 close_outfit_post_guard / vote_guard / opinion_guard / hide_replies /
--      image_guard / report_guard 六个触发器（函数体里的 public. 一律改成上面的真实 schema）。
--   4. ALTER TABLE reports ENABLE ROW LEVEL SECURITY; REVOKE ALL ON reports FROM PUBLIC;
--      执行前先确认 BFF 用的是哪类角色/密钥，避免把举报读写一起封掉。
--   5. 存储桶 looks 由 public 改为 private（在控制台 Storage 里操作，SQL 改不了）。
