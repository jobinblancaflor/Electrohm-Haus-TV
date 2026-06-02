# Spec: Category Filtering Feature

## Objective
Add a function to filter live TV channels by category across the application. Users should be able to select a category from the header to narrow down the list of displayed channels.

## Tech Stack
- React (TypeScript)
- Vite
- Tailwind CSS
- Lucide React (for icons)

## Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Preview: `npm run preview`

## Project Structure
- `src/app/App.tsx`: Main application state management (adding `selectedCategory` state and filtering logic).
- `src/app/components/Header.tsx`: UI for the category selection (adding a category dropdown).

## Code Style
```tsx
// Example of the proposed state in App.tsx
const [selectedCategory, setSelectedCategory] = useState<string>('All');

const filteredStreams = useMemo(() => {
  let result = streams;
  // ... existing search and country filters ...
  if (selectedCategory !== 'All') {
    result = result.filter(stream => stream.channel_category_ids.includes(selectedCategory));
  }
  return result;
}, [streams, searchQuery, selectedCountry, selectedCategory]);
```

## Testing Strategy
- Manual verification:
  - Select "Movies" from the category dropdown and verify only movie channels are shown.
  - Combine category filter with search query and verify results.
  - Combine category filter with country filter and verify results.
  - Reset category filter to "All" and verify all channels are restored.

## Boundaries
- Always: Follow existing TypeScript interfaces for `Stream` and `Category`.
- Ask first: If we should replace the hardcoded "Movies", "Sports" etc. links in the header with a dynamic category menu.
- Never: Modify the raw API fetching logic unless necessary for category support.

## Success Criteria
- [ ] A category selection dropdown is visible in the Header.
- [ ] Selecting a category updates the `filteredStreams` on the main page.
- [ ] The "All" option resets the category filter.
- [ ] The category filter works in conjunction with the search and country filters.

## Open Questions
1. Should the category filter be a simple `<select>` dropdown (like the country filter) or a more prominent menu?
2. Should selecting a category from the dropdown trigger the same "View All" detail view currently implemented for category sections, or just filter the home page?
3. Should the hardcoded "Live TV", "Movies", "Series", "Sports" links in the header be made functional using this new category filtering?
