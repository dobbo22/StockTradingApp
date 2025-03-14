import React from 'react';

export function Alert({ className, ...props }) {
  return (
    <div
      role="alert"
      className={`relative w-full rounded-lg border p-4 ${className}`}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }) {
  return (
    <div className={`text-sm [&_p]:leading-relaxed ${className}`} {...props} />
  );
}