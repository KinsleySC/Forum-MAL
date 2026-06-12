document.addEventListener('DOMContentLoaded', () => {

  const params = new URLSearchParams(window.location.search);
  const activeCategory = params.get('category');
  const activeFilter = params.get('filter');

  document.querySelectorAll('.filter-link[data-cat]').forEach(link => {
    if (link.dataset.cat === activeCategory) {
      link.classList.add('active');
      const allLink = document.querySelector('.filter-link:not([data-cat]):not([data-filter])');
      if (allLink) allLink.classList.remove('active');
    }
  });

  document.querySelectorAll('.filter-link[data-filter]').forEach(link => {
    if (link.dataset.filter === activeFilter) {
      link.classList.add('active');
      const allLink = document.querySelector('.filter-link:not([data-cat]):not([data-filter])');
      if (allLink) allLink.classList.remove('active');
    }
  });

  document.querySelectorAll('.edit-comment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const form = document.getElementById(`edit-comment-${id}`);
      if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      }
    });
  });

  document.querySelectorAll('.cancel-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = btn.closest('.edit-comment-form');
      if (form) form.style.display = 'none';
    });
  });
});
