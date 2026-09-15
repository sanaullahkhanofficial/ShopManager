import React from "react";
import clsx from "clsx";

type Variant = "default" | "primary" | "danger" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClass: Record<Variant, string> = {
  default: "btn",
  primary: "btn-primary",
  danger: "btn-danger",
  ghost: "btn border-transparent shadow-none hover:bg-stone-100",
};

export function Button({ variant = "default", className, ...props }: ButtonProps) {
  return <button className={clsx(variantClass[variant], className)} {...props} />;
}
