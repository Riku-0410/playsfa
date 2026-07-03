/**
 * ピル型チェックボックス。フィルタチップと同じ見た目で複数選択を表現する。
 * 同じ name で複数置き、サーバー側は formData.getAll(name) で受ける。
 */
export function CheckboxPill({
  name,
  value,
  defaultChecked,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  /** 指定するとcontrolledになる(onChangeとセットで) */
  checked?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex h-9 cursor-pointer select-none items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-secondary transition-colors hover:bg-sunken has-checked:border-night has-checked:bg-night has-checked:text-night-ink">
      <input
        type="checkbox"
        name={name}
        value={value}
        {...(checked !== undefined
          ? { checked, onChange }
          : { defaultChecked: defaultChecked ?? false })}
        className="sr-only"
      />
      {children}
    </label>
  );
}
