import { customType } from 'drizzle-orm/pg-core';

export const daterange = customType<{ data: string; driverParam: string }>({
  dataType() {
    return 'daterange';
  },
});

export const inet = customType<{ data: string; driverParam: string }>({
  dataType() {
    return 'inet';
  },
});
