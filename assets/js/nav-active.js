(() => {
  const current = window.location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll(".submed-global-nav .nav-link, .submed-global-nav .dropdown-item");
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    if (href === current) {
      link.classList.add("active");
      const dropdown = link.closest(".dropdown");
      if (dropdown) {
        const toggle = dropdown.querySelector(".dropdown-toggle");
        if (toggle) toggle.classList.add("active");
      }
    }
  });
})();
