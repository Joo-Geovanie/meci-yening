-- Jalankan pada SQL Editor proyek Supabase aplikasi magang yang benar.
-- Bucket privat; batas 5 MB desimal. Jangan gunakan bucket public untuk CV.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5000000,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
