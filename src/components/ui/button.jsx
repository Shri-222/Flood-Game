import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center shadow-md justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all ease-in hover:shadow-lg hover:scale-105",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className = "", variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  const variantClasses = buttonVariants({ variant, size })
  return (
    <Comp
      className={`${variantClasses} ${className}`}
      ref={ref}
      {...props}
    />
  )
})

Button.displayName = "Button"

export { Button, buttonVariants }
