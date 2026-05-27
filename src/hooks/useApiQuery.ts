import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiFetch, type ApiResponse } from "@/lib/api";

/**
 * useApiQuery — React Query wrapper for GET requests via apiFetch.
 * Automatically handles caching, refetching, and loading/error states.
 */
export function useApiQuery<T>(
  key: string | readonly unknown[],
  url: string,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">
) {
  return useQuery<T>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      const { data, error } = await apiFetch<T>(url);
      if (error) throw new Error(error);
      return data as T;
    },
    ...options,
  });
}

/**
 * useApiMutation — React Query mutation for POST/PUT/DELETE via apiFetch.
 * Automatically invalidates related queries on success.
 */
export function useApiMutation<TData = unknown, TBody = unknown>(
  urlFn: (body: TBody) => string,
  method: "POST" | "PUT" | "DELETE",
  options?: UseMutationOptions<ApiResponse<TData>, Error, TBody> & {
    invalidateKeys?: string[][];
  }
) {
  const queryClient = useQueryClient();
  const { invalidateKeys, ...mutationOptions } = options || {};

  return useMutation<ApiResponse<TData>, Error, TBody>({
    mutationFn: async (body) => {
      const fetchOptions: RequestInit & { noCsrf?: boolean } = {
        method,
      };
      if (method !== "DELETE" || body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }
      return apiFetch<TData>(urlFn(body), fetchOptions);
    },
    onSuccess: () => {
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    },
    ...mutationOptions,
  });
}

/**
 * usePrefetchQuery — Prefetch a query for instant navigation.
 */
export function usePrefetchQuery() {
  const queryClient = useQueryClient();

  return <T>(key: string | readonly unknown[], url: string) => {
    queryClient.prefetchQuery({
      queryKey: Array.isArray(key) ? key : [key],
      queryFn: async () => {
        const { data } = await apiFetch<T>(url);
        return data as T;
      },
      staleTime: 30 * 1000,
    });
  };
}
