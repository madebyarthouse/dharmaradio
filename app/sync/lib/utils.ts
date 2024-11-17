export const dharmaSeedBase = "https://dharmaseed.org";

export const urlForPage = (page: number) =>
  `${dharmaSeedBase}/talks/?page=${page}&search=&sort=-rec_date&page_items=100`;

export const slugify = (text: string, id: number | string) => {
  const baseSlug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${baseSlug}-${id}`;
};

export const sumTime = (time: string): number => {
  const timeParts = time.split(":");
  if (timeParts.length === 2) {
    const [minutes, seconds] = timeParts;
    return parseInt(minutes) * 60 + parseInt(seconds);
  }

  if (timeParts.length === 3) {
    const [hours, minutes, seconds] = timeParts;
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
  }

  console.log(`Invalid time for talk: ${time}`);
  return 0;
};
