const buttons = document.querySelectorAll<HTMLButtonElement>(".filter-tag");
const rows = document.querySelectorAll<HTMLElement>(".event-entry");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const genre = btn.dataset.genre;

    rows.forEach(row => {
      const rowGenre = row.dataset.genre;
      if (genre === "All" || rowGenre === genre) {
        row.style.display = "";
        const nextEl = row.nextElementSibling as HTMLElement | null;
        if (nextEl?.classList.contains("divider")) nextEl.style.display = "";
      } else {
        row.style.display = "none";
        const nextEl = row.nextElementSibling as HTMLElement | null;
        if (nextEl?.classList.contains("divider")) nextEl.style.display = "none";
      }
    });
  });
});
