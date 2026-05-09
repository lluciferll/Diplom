import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE,
});

/** @type {null | ((message: string, variant?: string) => void)} */
let networkErrorNotifier = null;

/** Регистрирует функцию показа тоста для сбоев связи и 5xx (один общий текст). */
export function setNetworkErrorNotifier(fn) {
  networkErrorNotifier = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response == null) {
      networkErrorNotifier?.("Не удалось связаться с сервером. Проверьте сеть или запуск API.", "error");
    } else if (err.response?.status >= 500) {
      networkErrorNotifier?.(`Сервер вернул ошибку (${err.response.status}). Попробуйте позже.`, "error");
    }
    return Promise.reject(err);
  },
);

export function setToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
