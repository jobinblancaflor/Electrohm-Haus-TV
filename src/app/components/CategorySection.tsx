import { ChevronRight } from 'lucide-react';

interface CategorySectionProps {
  title: string;
  children: React.ReactNode;
  onViewAll?: () => void;
}

export function CategorySection({ title, children, onViewAll }: CategorySectionProps) {
  return (
    <section className="py-6 md:py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
          {children}
        </div>
      </div>
    </section>
  );
}
