-- Migration: Adicionar novos campos na tabela pool_data
-- Execute este script no Editor SQL do Supabase

-- Adicionar novos campos à tabela pool_data
ALTER TABLE public.pool_data
ADD COLUMN IF NOT EXISTS initial_value DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS yield_percent DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS contribution_value DECIMAL(15, 2) DEFAULT 0;

-- Migrar dados existentes do campo invested_value para initial_value
UPDATE public.pool_data
SET initial_value = invested_value
WHERE initial_value = 0 OR initial_value IS NULL;

-- Opcional: Manter o campo invested_value para compatibilidade
-- ou remover depois que confirmar que tudo funciona:
-- ALTER TABLE public.pool_data DROP COLUMN invested_value;