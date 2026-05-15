export interface ProgressBuilder {
  build(): {
    id: string;
    bookId: string;
    userEmail: string;
    locatorJson: string;
    progressPercent: number;
    updatedAt: string;
  };
  withPercent(percent: number): ProgressBuilder;
  withLocator(locator: object): ProgressBuilder;
}

export function createProgressBuilder(): ProgressBuilder {
  let state = {
    id: crypto.randomUUID(),
    bookId: crypto.randomUUID(),
    userEmail: 'reader@example.com',
    locatorJson: JSON.stringify({ cfi: 'epubcfi(/6/4[chap01]!/4/2/1:100)' }),
    progressPercent: 25.5,
    updatedAt: new Date().toISOString(),
  };

  const self: ProgressBuilder = {
    build: () => ({ ...state }),
    withPercent: (percent: number) => {
      state = { ...state, progressPercent: percent };
      return self;
    },
    withLocator: (locator: object) => {
      state = { ...state, locatorJson: JSON.stringify(locator) };
      return self;
    },
  };

  return self;
}
