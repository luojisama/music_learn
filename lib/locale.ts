'use server';

import {cookies} from 'next/headers';

const COOKIE_NAME = 'NEXT_LOCALE';

export async function getUserLocale() {
  return (await cookies()).get(COOKIE_NAME)?.value || 'zh';
}

export async function setUserLocale(locale: string) {
  (await cookies()).set(COOKIE_NAME, locale);
}
