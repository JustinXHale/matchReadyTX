import {
  Checkbox as MuiCheckbox,
  FormControl,
  FormControlLabel,
  FormHelperText as MuiFormHelperText,
  FormLabel,
  Radio as MuiRadio,
  RadioGroup as MuiRadioGroup,
  Switch as MuiSwitch,
  TextField,
  type TextFieldProps,
} from '@mui/material';
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useId,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

export type TextInputProps = Omit<
  TextFieldProps,
  'onChange' | 'variant' | 'select'
> & {
  onChange?: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    value: string,
  ) => void;
  validated?: 'default' | 'error' | 'warning' | 'success';
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  readOnly?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  pattern?: string;
  inputMode?:
    | 'none'
    | 'text'
    | 'tel'
    | 'url'
    | 'email'
    | 'numeric'
    | 'decimal'
    | 'search';
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      onChange,
      validated,
      isRequired,
      isDisabled,
      isReadOnly,
      readOnly,
      disabled,
      required,
      error,
      helperText,
      fullWidth = true,
      size = 'small',
      min,
      max,
      step,
      pattern,
      inputMode,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <TextField
        inputRef={ref}
        fullWidth={fullWidth}
        size={size}
        required={isRequired ?? required}
        disabled={isDisabled ?? disabled}
        error={validated === 'error' || Boolean(error)}
        helperText={helperText}
        className={['pf-v6-c-form-control', className].filter(Boolean).join(' ')}
        slotProps={{
          htmlInput: {
            min,
            max,
            step,
            pattern,
            inputMode,
            readOnly: isReadOnly ?? readOnly,
          },
        }}
        onChange={(e) => onChange?.(e, e.target.value)}
        {...rest}
      />
    );
  },
);

export type TextAreaProps = TextInputProps & {
  resizeOrientation?: 'vertical' | 'horizontal' | 'both';
  rows?: number;
  autoResize?: boolean;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
    {
      onChange,
      validated,
      isRequired,
      isDisabled,
      isReadOnly,
      disabled,
      required,
      rows = 4,
      fullWidth = true,
      size = 'small',
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <TextField
        inputRef={ref}
        fullWidth={fullWidth}
        size={size}
        multiline
        minRows={rows}
        required={isRequired ?? required}
        disabled={isDisabled ?? disabled}
        error={validated === 'error'}
        className={['pf-v6-c-form-control', className].filter(Boolean).join(' ')}
        slotProps={{
          input: {
            readOnly: isReadOnly,
          },
        }}
        onChange={(e) => onChange?.(e, e.target.value)}
        {...rest}
      />
    );
  },
);

const FormSelectCtx = createContext<{
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>, value: string) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
  ouiaId?: string;
}>({});

export function FormSelectOption({
  value,
  label,
  isDisabled,
}: {
  value: string | number;
  label: ReactNode;
  isDisabled?: boolean;
}) {
  return (
    <option value={value} disabled={isDisabled}>
      {label}
    </option>
  );
}

export function FormSelect({
  value,
  onChange,
  children,
  isDisabled,
  id,
  className,
  'aria-label': ariaLabel,
  ouiaId,
  validated,
}: {
  value?: string;
  // Call sites type the event as FormEvent<HTMLSelectElement> — keep wide.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange?: (event: any, value: string) => void;
  children?: ReactNode;
  isDisabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
  ouiaId?: string;
  validated?: 'default' | 'error' | 'warning' | 'success';
}) {
  return (
    <FormSelectCtx.Provider
      value={{
        value,
        onChange,
        disabled: isDisabled,
        id,
        'aria-label': ariaLabel,
        className,
        ouiaId,
      }}
    >
      <TextField
        select
        fullWidth
        size="small"
        id={id}
        value={value ?? ''}
        disabled={isDisabled}
        error={validated === 'error'}
        className={['pf-v6-c-form-control', 'pf-v6-c-form-select', className]
          .filter(Boolean)
          .join(' ')}
        aria-label={ariaLabel}
        data-ouia-component-id={ouiaId}
        onChange={(e) => onChange?.(e, e.target.value)}
        SelectProps={{
          native: true,
        }}
        sx={{ minHeight: 48, '& .MuiInputBase-root': { minHeight: 48 } }}
      >
        {children}
      </TextField>
    </FormSelectCtx.Provider>
  );
}

export function FormGroup({
  label,
  fieldId,
  isRequired,
  children,
  className,
  labelInfo,
}: {
  label?: ReactNode;
  fieldId?: string;
  isRequired?: boolean;
  children?: ReactNode;
  className?: string;
  labelInfo?: ReactNode;
}) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  return (
    <FormControl
      fullWidth
      required={isRequired}
      className={['pf-v6-c-form__group', className].filter(Boolean).join(' ')}
      sx={{ gap: 0.75, display: 'flex', flexDirection: 'column' }}
    >
      {label != null ? (
        <FormLabel
          htmlFor={id}
          className="pf-v6-c-form__label pf-v6-c-form__group-label"
          sx={{ fontWeight: 600, color: 'text.primary' }}
        >
          {label}
          {labelInfo}
        </FormLabel>
      ) : null}
      <BoxWithId id={id}>{children}</BoxWithId>
    </FormControl>
  );
}

function BoxWithId({ id, children }: { id: string; children?: ReactNode }) {
  // Inject id onto first form control when possible
  const kids = Children.map(children, (child, index) => {
    if (index === 0 && isValidElement(child)) {
      return cloneElement(child as ReactElement<{ id?: string }>, {
        id: (child.props as { id?: string }).id ?? id,
      });
    }
    return child;
  });
  return <>{kids}</>;
}

export function Form({
  children,
  className,
  onSubmit,
}: {
  children?: ReactNode;
  className?: string;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className={['pf-v6-c-form', className].filter(Boolean).join(' ')}
      onSubmit={onSubmit}
      noValidate
    >
      {children}
    </form>
  );
}

export function FormHelperText({ children }: { children?: ReactNode }) {
  return <MuiFormHelperText component="div">{children}</MuiFormHelperText>;
}

export function HelperText({ children }: { children?: ReactNode }) {
  return <MuiFormHelperText component="div">{children}</MuiFormHelperText>;
}

export function HelperTextItem({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function Checkbox({
  id,
  label,
  isChecked,
  checked,
  onChange,
  isDisabled,
  description,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string;
  label?: ReactNode;
  isChecked?: boolean;
  checked?: boolean;
  onChange?: (event: unknown, checked: boolean) => void;
  isDisabled?: boolean;
  description?: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const control = (
    <MuiCheckbox
      id={id}
      checked={isChecked ?? checked ?? false}
      disabled={isDisabled}
      inputProps={{ 'aria-label': ariaLabel }}
      onChange={(e, next) => onChange?.(e, next)}
      sx={{ minWidth: 48, minHeight: 48 }}
    />
  );
  if (label == null && description == null) {
    return <span className={className}>{control}</span>;
  }
  return (
    <FormControlLabel
      className={className}
      control={control}
      label={
        <>
          {label}
          {description ? (
            <MuiFormHelperText sx={{ m: 0 }}>{description}</MuiFormHelperText>
          ) : null}
        </>
      }
    />
  );
}

export function Radio({
  id,
  name,
  label,
  isChecked,
  checked,
  onChange,
  isDisabled,
  value,
  'aria-label': ariaLabel,
}: {
  id?: string;
  name?: string;
  label?: ReactNode;
  isChecked?: boolean;
  checked?: boolean;
  onChange?: (event: unknown) => void;
  isDisabled?: boolean;
  value?: string;
  'aria-label'?: string;
}) {
  return (
    <FormControlLabel
      control={
        <MuiRadio
          id={id}
          name={name}
          checked={isChecked ?? checked}
          value={value}
          disabled={isDisabled}
          inputProps={{ 'aria-label': ariaLabel }}
          onChange={(e) => onChange?.(e)}
          sx={{ minWidth: 48, minHeight: 48 }}
        />
      }
      label={label}
    />
  );
}

/** Minimal RadioGroup passthrough for grouping Radios by name. */
export function RadioGroup({
  children,
  ...rest
}: {
  children?: ReactNode;
  name?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>, value: string) => void;
}) {
  return <MuiRadioGroup {...rest}>{children}</MuiRadioGroup>;
}

export function Switch({
  id,
  label,
  isChecked,
  checked,
  onChange,
  isDisabled,
  'aria-label': ariaLabel,
}: {
  id?: string;
  label?: ReactNode;
  isChecked?: boolean;
  checked?: boolean;
  onChange?: (event: unknown, checked: boolean) => void;
  isDisabled?: boolean;
  'aria-label'?: string;
}) {
  const control = (
    <MuiSwitch
      id={id}
      checked={isChecked ?? checked ?? false}
      disabled={isDisabled}
      inputProps={{ 'aria-label': ariaLabel }}
      onChange={(e, next) => onChange?.(e, next)}
    />
  );
  if (label == null) return control;
  return <FormControlLabel control={control} label={label} />;
}

// silence unused context warning — available for future Select non-native mode
void useContext;
