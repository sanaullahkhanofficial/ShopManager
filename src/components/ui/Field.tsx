import React from "react";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
export function Field({ label, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}
export function SelectField({ label, children, ...props }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" {...props}>{children}</select>
    </label>
  );
}

interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}
export function TextAreaField({ label, ...props }: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="input" rows={3} {...props} />
    </label>
  );
}
