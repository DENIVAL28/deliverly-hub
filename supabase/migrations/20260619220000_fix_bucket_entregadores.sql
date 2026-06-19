-- Garante que o bucket existe e aceita qualquer imagem
-- (a conversao para JPEG ja e feita no client antes do upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entregadores',
  'entregadores',
  true,
  5242880,
  NULL  -- NULL = aceita qualquer MIME type
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = NULL,
  public             = true,
  file_size_limit    = 5242880;
