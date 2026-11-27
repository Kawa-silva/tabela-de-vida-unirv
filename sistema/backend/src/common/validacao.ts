import { ApiException } from './api.exception';

/**
 * Funções de validação de entrada (parâmetros de rota e corpo das requisições).
 * Lançam ApiException 400 com mensagem clara quando o dado é inválido.
 */
export function texto(valor: unknown, campo: string, obrigatorio = true, max = 255): string {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (obrigatorio) throw ApiException.badRequest(`O campo "${campo}" é obrigatório.`);
    return '';
  }
  const s = String(valor).trim();
  if (s.length > max) throw ApiException.badRequest(`O campo "${campo}" aceita no máximo ${max} caracteres.`);
  return s;
}

export function inteiro(valor: unknown, campo: string, min: number, max: number): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw ApiException.badRequest(`O campo "${campo}" deve ser um inteiro entre ${min} e ${max}.`);
  }
  return n;
}

export function numero(valor: unknown, campo: string, min = -Infinity, max = Infinity): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw ApiException.badRequest(`O campo "${campo}" deve ser um número entre ${min} e ${max}.`);
  }
  return n;
}

export function objeto<T = Record<string, unknown>>(valor: unknown, campo = 'corpo'): T {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw ApiException.badRequest(`O ${campo} da requisição deve ser um objeto JSON.`);
  }
  return valor as T;
}

export function lista<T = unknown>(valor: unknown, campo: string, minimo = 0): T[] {
  if (!Array.isArray(valor) || valor.length < minimo) {
    throw ApiException.badRequest(`O campo "${campo}" deve ser uma lista com pelo menos ${minimo} item(ns).`);
  }
  return valor as T[];
}
