import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return <table className={`min-w-full divide-y divide-gray-200 ${className}`}>{children}</table>;
}

export function TableHeader({ children, className = '' }: TableProps) {
  return <thead className={`bg-gray-50 ${className}`}>{children}</thead>;
}

export function TableBody({ children, className = '' }: TableProps) {
  return <tbody className={`divide-y divide-gray-200 bg-white ${className}`}>{children}</tbody>;
}

export function TableRow({ children, className = '', ...props }: TableProps & React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={className} {...props}>{children}</tr>;
}

export function TableHead({ children, className = '' }: TableProps) {
  return <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${className}`}>{children}</th>;
}

export function TableCell({ children, className = '', ...props }: TableProps & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`whitespace-nowrap px-6 py-4 text-sm text-gray-900 ${className}`} {...props}>{children}</td>;
}
