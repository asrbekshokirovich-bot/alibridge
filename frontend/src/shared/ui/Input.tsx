interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: React.ReactNode
}

export function Input({ label, icon, className = '', ...rest }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          {...rest}
          className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 h-[52px] bg-white border border-slate-200 rounded-2xl text-[15px] placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/25 focus:outline-none transition-all ${className}`}
        />
      </div>
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className = '', ...rest }: TextareaProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <textarea
        {...rest}
        className={`w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-[15px] placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/25 focus:outline-none transition-all resize-none ${className}`}
      />
    </div>
  )
}
