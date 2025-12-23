export function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-") // replace spaces & symbols with -
        .replace(/^-+|-+$/g, ""); // remove starting/ending hyphens
}
