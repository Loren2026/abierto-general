-- Allow webapp/external_url projects to exist without a OneDrive source file.
-- Existing OneDrive projects keep their source_file_id values; backend validation still
-- requires sourceFileId for sourceType='onedrive'.
alter table public.projects
  alter column source_file_id drop not null;
