-- 仅本地准备，未执行。用户先核对实际 schema、列类型、权限和历史数据，再决定应用。
-- 假设业务表在 public，已有 posts/votes/opinions/post_images，id 与外键均为 uuid。
-- user_id 继续引用现有 Auth 身份；不创建 users/accounts，不修改 auth.users。
-- 索引创建遇到重复票、孤儿图片、旧演示投票时会失败并回滚；不得自动删除历史记录。
-- BFF 需要受限服务端数据库凭证；匿名/应用 JWT 不应直接写这些表或读取举报。
-- 存储 looks 必须私有，原图只能经可见性代理访问；SQL 不会改变远端存储权限。
BEGIN;

ALTER TABLE public.posts
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
-- 不静默四舍五入或丢弃历史价格，遇到精度不符先停止供用户核对。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.posts WHERE price < 0 OR price > 999999.99 OR price::numeric <> round(price::numeric, 2)) THEN
    RAISE EXCEPTION 'legacy price requires review before numeric migration';
  END IF;
END $$;
ALTER TABLE public.posts ALTER COLUMN price TYPE numeric(8,2) USING price::numeric(8,2);
ALTER TABLE public.opinions
  ADD COLUMN IF NOT EXISTS parent_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id),
  opinion_id uuid REFERENCES public.opinions(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 两个部分索引兼容 NULL 举报目标，每人每个内容最多一条待处理举报。
CREATE UNIQUE INDEX IF NOT EXISTS reports_pending_post_unique
  ON public.reports(user_id, post_id) WHERE status = 'pending' AND opinion_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_pending_opinion_unique
  ON public.reports(user_id, post_id, opinion_id) WHERE status = 'pending' AND opinion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS votes_user_post_unique ON public.votes(user_id, post_id);
CREATE UNIQUE INDEX IF NOT EXISTS post_images_position_unique ON public.post_images(post_id, position);
CREATE INDEX IF NOT EXISTS opinions_parent_idx ON public.opinions(parent_id);
CREATE INDEX IF NOT EXISTS posts_visible_created_idx ON public.posts(created_at, id)
  WHERE deleted_at IS NULL AND hidden_at IS NULL AND status = 'published' AND NOT is_demo;

-- NOT VALID 保留旧数据；新写入立即约束，历史违规项由用户核对后再 VALIDATE。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_return_check' AND conrelid = 'public.posts'::regclass) THEN
    ALTER TABLE public.posts ADD CONSTRAINT close_outfit_return_check CHECK (
      return_status IN ('known', 'unknown', 'unavailable') AND
      ((return_status = 'known' AND return_deadline IS NOT NULL) OR
       (return_status <> 'known' AND return_deadline IS NULL))
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_fields_check' AND conrelid = 'public.posts'::regclass) THEN
    ALTER TABLE public.posts ADD CONSTRAINT close_outfit_fields_check CHECK (
      char_length(coalesce(brand, '')) <= 30 AND char_length(coalesce(desired_effect, '')) <= 120 AND
      char_length(coalesce(decision_reason, '')) <= 180 AND
      (price IS NULL OR price BETWEEN 0 AND 999999.99) AND
      status IN ('publishing', 'published', 'hidden', 'deleted')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_votes_post_fk' AND conrelid = 'public.votes'::regclass) THEN
    ALTER TABLE public.votes ADD CONSTRAINT close_outfit_votes_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_opinions_post_fk' AND conrelid = 'public.opinions'::regclass) THEN
    ALTER TABLE public.opinions ADD CONSTRAINT close_outfit_opinions_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_opinions_parent_fk' AND conrelid = 'public.opinions'::regclass) THEN
    ALTER TABLE public.opinions ADD CONSTRAINT close_outfit_opinions_parent_fk FOREIGN KEY (parent_id) REFERENCES public.opinions(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'close_outfit_images_post_fk' AND conrelid = 'public.post_images'::regclass) THEN
    ALTER TABLE public.post_images ADD CONSTRAINT close_outfit_images_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.close_outfit_post_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE image_count integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'post identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.deleted_at IS NOT NULL AND (NEW.deleted_at IS NULL OR NEW.status <> 'deleted') THEN
      RAISE EXCEPTION 'deleted post cannot be restored' USING ERRCODE = '23514';
    END IF;
    IF OLD.votes_closed_at IS NOT NULL THEN NEW.votes_closed_at := OLD.votes_closed_at; END IF;
  END IF;
  IF NEW.decision IS NOT NULL THEN
    IF NEW.kind = 'style' OR NEW.decision NOT IN ('kept', 'returned') THEN
      RAISE EXCEPTION 'invalid decision' USING ERRCODE = '23514';
    END IF;
    NEW.votes_closed_at := coalesce(NEW.votes_closed_at, now());
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status = 'publishing' AND NEW.status = 'published') THEN
    IF char_length(trim(coalesce(NEW.story, ''))) NOT BETWEEN 4 AND 400 THEN
      RAISE EXCEPTION 'invalid story' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'published' THEN
      SELECT count(*) INTO image_count FROM public.post_images WHERE post_id = NEW.id;
      IF image_count NOT BETWEEN 1 AND 9 THEN
        RAISE EXCEPTION 'all images must be persisted before publishing' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_outfit_post_guard ON public.posts;
CREATE TRIGGER close_outfit_post_guard BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.close_outfit_post_guard();

CREATE OR REPLACE FUNCTION public.close_outfit_vote_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE p public.posts%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'vote identity is immutable' USING ERRCODE = '23514';
  END IF;
  -- 与关闭投票 UPDATE 使用同一帖子行锁；跨进程仍按数据库提交顺序串行。
  SELECT * INTO p FROM public.posts WHERE id = NEW.post_id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'published' OR p.deleted_at IS NOT NULL OR p.hidden_at IS NOT NULL OR p.is_demo THEN
    RAISE EXCEPTION 'post unavailable' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS NULL OR p.user_id = NEW.user_id OR p.kind = 'style' OR p.votes_closed_at IS NOT NULL OR p.decision IS NOT NULL OR NEW.stance IS NULL OR NEW.stance NOT IN ('keep', 'return') THEN
    RAISE EXCEPTION 'vote forbidden or closed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_outfit_vote_guard ON public.votes;
CREATE TRIGGER close_outfit_vote_guard BEFORE INSERT OR UPDATE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.close_outfit_vote_guard();

CREATE OR REPLACE FUNCTION public.close_outfit_opinion_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE p public.posts%ROWTYPE; ancestor public.opinions%ROWTYPE; next_id uuid; visited uuid[];
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = NEW.post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'post unavailable' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR
       NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
      RAISE EXCEPTION 'opinion identity and parent are immutable' USING ERRCODE = '23514';
    END IF;
    -- 撤回及运营隐藏在关闭后仍允许；内容不得通过恢复时间戳重新出现。
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL OR OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL THEN
      RAISE EXCEPTION 'removed opinion cannot be restored' USING ERRCODE = '23514';
    END IF;
    IF NEW.deleted_at IS NOT NULL OR NEW.hidden_at IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  IF p.status <> 'published' OR p.deleted_at IS NOT NULL OR p.hidden_at IS NOT NULL OR p.is_demo THEN
    RAISE EXCEPTION 'post unavailable' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS NULL OR char_length(trim(coalesce(NEW.body, ''))) NOT BETWEEN 4 AND 180 OR NEW.stance IS NULL OR NEW.stance NOT IN ('keep', 'return', 'style') THEN
    RAISE EXCEPTION 'invalid opinion' USING ERRCODE = '23514';
  END IF;
  visited := ARRAY[NEW.id]; next_id := NEW.parent_id;
  WHILE next_id IS NOT NULL LOOP
    IF next_id = ANY(visited) THEN RAISE EXCEPTION 'reply cycle' USING ERRCODE = '23514'; END IF;
    SELECT * INTO ancestor FROM public.opinions WHERE id = next_id;
    IF NOT FOUND OR ancestor.post_id <> NEW.post_id OR ancestor.deleted_at IS NOT NULL OR ancestor.hidden_at IS NOT NULL THEN
      RAISE EXCEPTION 'invalid reply parent' USING ERRCODE = '23514';
    END IF;
    visited := array_append(visited, next_id); next_id := ancestor.parent_id;
  END LOOP;
  IF p.user_id = NEW.user_id OR NEW.parent_id IS NOT NULL OR p.kind = 'style' THEN NEW.stance := 'style'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_outfit_opinion_guard ON public.opinions;
CREATE TRIGGER close_outfit_opinion_guard BEFORE INSERT OR UPDATE ON public.opinions
  FOR EACH ROW EXECUTE FUNCTION public.close_outfit_opinion_guard();

CREATE OR REPLACE FUNCTION public.close_outfit_hide_replies() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) OR (NEW.hidden_at IS NOT NULL AND OLD.hidden_at IS NULL) THEN
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM public.opinions WHERE parent_id = NEW.id AND post_id = NEW.post_id
      UNION
      SELECT o.id FROM public.opinions o JOIN descendants d ON o.parent_id = d.id WHERE o.post_id = NEW.post_id
    )
    UPDATE public.opinions SET hidden_at = coalesce(hidden_at, now()) WHERE id IN (SELECT id FROM descendants);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_outfit_hide_replies ON public.opinions;
CREATE TRIGGER close_outfit_hide_replies AFTER UPDATE ON public.opinions
  FOR EACH ROW EXECUTE FUNCTION public.close_outfit_hide_replies();

CREATE OR REPLACE FUNCTION public.close_outfit_image_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE p public.posts%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = NEW.post_id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'publishing' OR p.deleted_at IS NOT NULL OR p.hidden_at IS NOT NULL OR p.is_demo THEN
    RAISE EXCEPTION 'images can only be attached to an active publishing post' USING ERRCODE = '23514';
  END IF;
  IF NEW.position IS NULL OR NEW.position NOT BETWEEN 0 AND 8 OR NEW.image_url IS NULL THEN
    RAISE EXCEPTION 'invalid image position or URL' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'image ownership is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_outfit_image_guard ON public.post_images;
CREATE TRIGGER close_outfit_image_guard BEFORE INSERT OR UPDATE ON public.post_images
  FOR EACH ROW EXECUTE FUNCTION public.close_outfit_image_guard();

CREATE OR REPLACE FUNCTION public.close_outfit_report_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE p public.posts%ROWTYPE; o public.opinions%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> 'pending' THEN RETURN NEW; END IF;
  IF NEW.reason NOT IN ('privacy', 'harassment', 'advertising', 'other', '隐私泄露', '辱骂或骚扰', '广告', '其他') THEN
    RAISE EXCEPTION 'invalid report reason' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO p FROM public.posts WHERE id = NEW.post_id FOR UPDATE;
  IF NOT FOUND OR p.deleted_at IS NOT NULL OR p.hidden_at IS NOT NULL OR p.status <> 'published' OR p.is_demo THEN
    RAISE EXCEPTION 'report target unavailable' USING ERRCODE = '23514';
  END IF;
  IF NEW.opinion_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opinions WHERE id = NEW.opinion_id;
    IF NOT FOUND OR o.post_id <> NEW.post_id OR o.deleted_at IS NOT NULL OR o.hidden_at IS NOT NULL THEN
      RAISE EXCEPTION 'invalid report opinion' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_outfit_report_guard ON public.reports;
CREATE TRIGGER close_outfit_report_guard BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.close_outfit_report_guard();

-- 不向普通用户提供举报读取或治理策略；人工运营必须使用受限服务端角色。
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM PUBLIC;
COMMIT;

-- 远端验收待办：核对实际 schema 与 Auth 外键、旧唯一约束/孤儿记录、BFF 凭证与现有 RLS。
-- 并行会话验证首次投票/改投与关闭、撤回父评论与新回复、删除与投票。
-- 核实 REST limit/offset/PATCH 语义及返回错误码，确认 looks 私有且历史公开 URL 不可直取。
-- 失败发布保留 publishing 记录时，运营先确认未公开，再按 post_id 清理关联资源后删除待发布记录。
-- image_cleanup_pending=true 的已删除帖可由作者重复 delete 重试清理，永不恢复可见性。
