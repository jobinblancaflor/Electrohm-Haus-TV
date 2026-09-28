import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown, Search, Star, X } from 'lucide-react';
import type { Language } from '../types';
import { countryName, formatCount } from '../lib/format';

export interface CountryOption {
  code: string;
  count: number;
}

export interface CategoryOption {
  id: string;
  name: string;
  count: number;
}

export interface LanguageOption extends Language {
  count: number;
}

/** Pseudo-category id for the favorites view. */
export const FAVORITES = 'favorites';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  countries: CountryOption[];
  selectedCountry: string;
  onCountryChange: (country: string) => void;
  languages: LanguageOption[];
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  categories: CategoryOption[];
  totalInPool: number;
  favoriteCount: number;
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onHome: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  countries,
  selectedCountry,
  onCountryChange,
  languages,
  selectedLanguage,
  onLanguageChange,
  categories,
  totalInPool,
  favoriteCount,
  selectedCategoryId,
  onCategoryChange,
  onHome,
}: HeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" jumps to search from anywhere except another text field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key !== '/' || target?.closest('input, textarea, select, [contenteditable]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const countrySelect = (compact: boolean) => (
    <FilterSelect label="Country" value={selectedCountry} onChange={onCountryChange} compact={compact}>
      <option value="All">All countries</option>
      {countries.map((country) => (
        <option key={country.code} value={country.code}>
          {countryName(country.code)}
          {compact ? '' : ` (${formatCount(country.count)})`}
        </option>
      ))}
    </FilterSelect>
  );

  const languageSelect = (compact: boolean) => (
    <FilterSelect label="Language" value={selectedLanguage} onChange={onLanguageChange} compact={compact}>
      <option value="All">All languages</option>
      {languages.map((language) => (
        <option key={language.code} value={language.code}>
          {language.name}
          {compact ? '' : ` (${formatCount(language.count)})`}
        </option>
      ))}
    </FilterSelect>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 md:gap-4 md:px-8">
        <button type="button" onClick={onHome} className="flex shrink-0 items-baseline gap-2 rounded" aria-label="Electrohm Haus TV, go to home">
          <span className="font-display text-2xl leading-none font-extrabold tracking-tight uppercase md:text-[1.7rem]">
            Electrohm
          </span>
          <span className="hidden rounded-sm bg-amber px-1.5 py-0.5 font-mono text-[9px] leading-none font-semibold tracking-widest text-ink xs:inline">
            HAUS TV
          </span>
        </button>

        <label className="group relative ml-auto flex h-10 min-w-0 flex-1 items-center rounded-full border border-line bg-panel transition-colors focus-within:border-amber md:ml-4 md:max-w-md">
          <span className="sr-only">Search channels</span>
          <Search className="pointer-events-none ml-3.5 size-4 shrink-0 text-dim" />
          <input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && onSearchChange('')}
            placeholder="Search channels"
            autoComplete="off"
            spellCheck={false}
            className="h-full w-full min-w-0 bg-transparent px-2.5 text-sm text-paper outline-none placeholder:text-dim [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                searchRef.current?.focus();
              }}
              className="mr-2 flex size-7 shrink-0 items-center justify-center rounded-full text-dim hover:bg-raised hover:text-paper"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="mr-3 hidden rounded border border-line px-1.5 font-mono text-[10px] text-dim md:block">/</kbd>
          )}
        </label>

        <div className="hidden shrink-0 gap-2 md:flex">
          {countrySelect(false)}
          {languageSelect(false)}
        </div>
      </div>

      <nav
        aria-label="Filters and categories"
        className="no-scrollbar mx-auto flex max-w-[1500px] items-center gap-1.5 overflow-x-auto px-4 pb-3 md:px-8"
      >
        <div className="flex shrink-0 gap-1.5 md:hidden">
          {countrySelect(true)}
          {languageSelect(true)}
          <span aria-hidden className="mx-1 w-px self-stretch bg-line" />
        </div>
        {favoriteCount > 0 && (
          <CategoryChip
            label={
              <>
                <Star className="size-3.5 fill-current" />
                My channels
              </>
            }
            count={favoriteCount}
            active={selectedCategoryId === FAVORITES}
            onClick={() => onCategoryChange(FAVORITES)}
          />
        )}
        <CategoryChip
          label="All channels"
          count={totalInPool}
          active={selectedCategoryId === 'all'}
          onClick={() => onCategoryChange('all')}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.name}
            count={category.count}
            active={selectedCategoryId === category.id}
            onClick={() => onCategoryChange(category.id)}
          />
        ))}
      </nav>
    </header>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  compact,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact: boolean;
  children: ReactNode;
}) {
  const active = value !== 'All';
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`appearance-none truncate rounded-full border bg-panel text-paper outline-none hover:border-dim focus-visible:border-amber ${
          active ? 'border-amber/70' : 'border-line'
        } ${compact ? 'h-8 max-w-36 pr-7 pl-3 text-xs' : 'h-10 max-w-[13rem] pr-9 pl-4 text-sm'}`}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-dim ${compact ? 'right-2.5 size-3.5' : 'right-3.5 size-4'}`}
      />
    </label>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors ${
        active ? 'border-amber bg-amber text-ink' : 'border-line text-paper/85 hover:border-dim hover:text-paper'
      }`}
    >
      {label}
      <span className={`ml-0.5 font-mono text-[10px] ${active ? 'text-ink/70' : 'text-dim'}`}>{formatCount(count)}</span>
    </button>
  );
}
