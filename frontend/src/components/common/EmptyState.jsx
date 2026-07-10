export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4"><Icon className="text-3xl text-slate-400" /></div>}
    <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
    {description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{description}</p>}
    {action}
  </div>
);
