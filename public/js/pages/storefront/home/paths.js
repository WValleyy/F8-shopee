function createHomePaths(sortGroups) {
  function read(path) {
    const url = new URL(path, window.location.origin);
    const rawSort = url.searchParams.get("sort");
    const query = url.searchParams.get("q") ?? "";
    const sortCriteria = rawSort
      ? rawSort
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : query
        ? []
        : ["popular"];

    return {
      url,
      category: url.searchParams.get("category") ?? "all",
      sortCriteria,
    };
  }

  function toPath(url) {
    return `${url.pathname}${url.search}`;
  }

  function removeSortGroup(criteria, group) {
    return criteria.filter((item) => sortGroups[item] !== group);
  }

  function toggleSortCriterion(criteria, criterion) {
    const group = sortGroups[criterion];

    if (criteria.includes(criterion))
      return criteria.filter((item) => item !== criterion);

    return [...removeSortGroup(criteria, group), criterion];
  }

  function writeSortCriteria(url, criteria) {
    const value = criteria.join(",");
    const defaultSort = url.searchParams.get("q") ? "" : "popular";

    if (value && value !== defaultSort) url.searchParams.set("sort", value);
    else url.searchParams.delete("sort");
  }

  function category(path, categorySlug) {
    const { url } = read(path);

    if (categorySlug !== "all") url.searchParams.set("category", categorySlug);
    else url.searchParams.delete("category");

    url.searchParams.delete("sort");
    url.searchParams.delete("page");
    return toPath(url);
  }

  function sort(path, criterion) {
    const { url, sortCriteria } = read(path);
    const nextCriteria = toggleSortCriterion(sortCriteria, criterion);

    writeSortCriteria(url, nextCriteria);
    url.searchParams.delete("page");
    return toPath(url);
  }

  function page(path, pageNumber) {
    const { url } = read(path);
    const pageValue = Math.max(1, Number(pageNumber));

    if (pageValue > 1) url.searchParams.set("page", String(pageValue));
    else url.searchParams.delete("page");

    return toPath(url);
  }

  return { category, page, read, sort };
}

export { createHomePaths };
