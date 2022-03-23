import { ActionPanel, Action, List, showToast, Toast, getPreferenceValues } from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import fetch, { AbortError } from "node-fetch";

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List
      isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Search npm packages..."
      throttle
    >
      <List.Section title="Results" subtitle={state.results.length + ""}>
        {state.results.map((searchResult: any) => (
          <SearchListItem key={searchResult.title} searchResult={searchResult} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ searchResult }: { searchResult: Result & { url: string } }) {
  return (
    <List.Item
      title={searchResult.title}
      subtitle={searchResult.overview}
      accessoryTitle={searchResult.title}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Browser" url={searchResult.url} />
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();
      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await performSearch(searchText, cancelRef.current.signal);
        setState((oldState) => ({
          ...oldState,
          results: results,
          isLoading: false,
        }));
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        if (error instanceof AbortError) {
          return;
        }

        console.error("search error", error);
        showToast({ style: Toast.Style.Failure, title: "Could not perform search", message: String(error) });
      }
    },
    [cancelRef, setState]
  );

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}

async function performSearch(searchText: string, signal: AbortSignal): Promise<SearchResult[]> {
  const key = getPreferenceValues().api_key;

  const params = new URLSearchParams();
  params.append("query", searchText.length === 0 ? "The" : searchText);

  const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${key}&${params.toString()}`, {
    method: "get",
    signal: signal,
  });

  const json = (await response.json()) as
    | SearchResult
    | { status_code: number; status_message: string; success: boolean };

  if (!response.ok || "status_message" in json) {
    throw new Error("status_message" in json ? json.status_message : response.statusText);
  }

  return json.results.map((result: Result): any => {
    return {
      title: result.title,
      overview: result.overview,
      url: `https://www.themoviedb.org/movie/${result.id}`,
    };
  });
}

interface SearchState {
  results: SearchResult[];
  isLoading: boolean;
}

interface SearchResult {
  page: number;
  results: Result[];
  total_pages: number;
  total_results: number;
}

export interface Result {
  adult: boolean;
  backdrop_path?: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path?: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}
