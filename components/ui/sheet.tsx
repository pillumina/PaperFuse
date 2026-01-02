'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Sheet = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
  return (
    <>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => onOpenChange(false)}
          />
          {/* Sheet content will be rendered by SheetContent */}
        </div>
      )}
    </>
  );
};

const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; children?: React.ReactNode }
>(({ className, asChild, children, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ...props,
    });
  }
  return <button ref={ref} className={cn(className)} {...props}>{children}</button>;
});
SheetTrigger.displayName = 'SheetTrigger';

const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { side?: 'left' | 'right' | 'top' | 'bottom' }
>(({ className, children, side = 'left', ...props }, ref) => {
  const sideClasses = {
    left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r',
    right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l',
    top: 'inset-x-0 top-0 h-auto max-h-sm border-b',
    bottom: 'inset-x-0 bottom-0 h-auto max-h-sm border-t',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out duration-300',
        'overflow-y-auto',
        sideClasses[side],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left mb-6', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-lg font-semibold text-foreground', className)} {...props} />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
SheetDescription.displayName = 'SheetDescription';

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger };
