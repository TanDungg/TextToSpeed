import { useLocation } from 'react-router-dom';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { createBrowserHistory } from 'history';

export const history = createBrowserHistory();

export default function useSearchParams(defaultInit = '') {
  const location = useLocation();
  const [search, setSearch] = useState(location.search);

  useEffect(() => {
    setSearch(location.search);
  }, [location.search]);

  useEffect(() => {
    const update = () => setSearch(window.location.search);

    window.addEventListener('popstate', update);
    window.addEventListener('pushstate', update);
    window.addEventListener('replacestate', update);

    const unlisten = history.listen(() => {
      setSearch(window.location.search);
    });

    return () => {
      unlisten();
      window.removeEventListener('popstate', update);
      window.removeEventListener('pushstate', update);
      window.removeEventListener('replacestate', update);
    };
  }, []);

  const searchParams = useMemo(() => {
    return new URLSearchParams(search || defaultInit);
  }, [search, defaultInit]);

  const setSearchParams = useCallback(
    (nextInit, options = {}) => {
      let newParams;

      if (nextInit instanceof URLSearchParams) {
        newParams = new URLSearchParams(nextInit);
      } else if (typeof nextInit === 'object' && nextInit !== null) {
        newParams = new URLSearchParams(searchParams);
        Object.entries(nextInit).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            newParams.delete(key);
          } else {
            newParams.set(key, String(value));
          }
        });
      } else {
        newParams = new URLSearchParams(nextInit);
      }

      const newSearch = newParams.toString();
      const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;

      if (options.navigate) {
        history[options.replace ? 'replace' : 'push'](newUrl);
      } else {
        if (options.replace) {
          window.history.replaceState({}, '', newUrl);
        } else {
          window.history.pushState({}, '', newUrl);
        }

        setSearch(newSearch ? `?${newSearch}` : '');
      }
    },
    [location.pathname, searchParams]
  );

  return [searchParams, setSearchParams];
}
