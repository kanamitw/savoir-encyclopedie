-- Schéma de départ pour une encyclopédie collaborative.
-- À exécuter dans Supabase > SQL Editor.
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  category text not null,
  excerpt text default '',
  body text not null check (char_length(body) >= 30),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Contributeur',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.articles enable row level security;

-- Tout le monde peut lire les articles publiés.
create policy "Articles lisibles par tous"
on public.articles for select
to anon, authenticated
using (true);

-- Seuls les utilisateurs connectés peuvent publier.
create policy "Utilisateurs connectés peuvent publier"
on public.articles for insert
to authenticated
with check (auth.uid() = author_id);

-- Un auteur peut modifier uniquement ses propres articles.
create policy "Auteur peut modifier son article"
on public.articles for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

-- Un auteur peut supprimer uniquement ses propres articles.
create policy "Auteur peut supprimer son article"
on public.articles for delete
to authenticated
using (auth.uid() = author_id);

create index if not exists articles_created_at_idx on public.articles (created_at desc);
create index if not exists articles_category_idx on public.articles (category);
