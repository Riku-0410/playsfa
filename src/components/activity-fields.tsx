import { Field, Label } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ACTIVITY_AUTHORS, ACTIVITY_TYPES } from "@/lib/activity";

/**
 * 活動ログの入力フィールド一式(<form> は呼び出し側が持つ)。
 * actions には送信ボタン(+スキップ等)を渡す。期日の右隣に並ぶ。
 */
export function ActivityFields({ actions }: { actions: React.ReactNode }) {
  return (
    <>
      <div className="flex gap-3">
        <Field className="w-36 shrink-0">
          <Label htmlFor="act-type">種類</Label>
          <Select id="act-type" name="type" defaultValue="memo">
            {Object.entries(ACTIVITY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field className="flex-1">
          <Label htmlFor="act-content">内容</Label>
          <Textarea
            id="act-content"
            name="content"
            required
            className="min-h-11 h-11 py-2.5"
            placeholder="電話で状況ヒアリング。競合の更新月は来年3月…"
          />
        </Field>
      </div>
      <div className="space-y-3">
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-ink-secondary">記入者</legend>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_AUTHORS.map((author) => (
              <label
                key={author}
                className="inline-flex h-9 cursor-pointer select-none items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-secondary transition-colors hover:bg-sunken has-checked:border-night has-checked:bg-night has-checked:text-night-ink"
              >
                <input
                  type="radio"
                  name="author_name"
                  value={author}
                  required
                  className="sr-only"
                />
                {author}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-1 gap-3">
            <Field className="flex-1">
              <Label htmlFor="act-next">次のアクション</Label>
              <Input id="act-next" name="next_action" placeholder="デモ日程の調整" />
            </Field>
            <Field className="w-40 shrink-0">
              <Label htmlFor="act-next-date">期日</Label>
              <Input id="act-next-date" name="next_action_date" type="date" />
            </Field>
          </div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </div>
      </div>
    </>
  );
}
