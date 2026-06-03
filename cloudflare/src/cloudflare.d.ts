type D1Value = string | number | boolean | null;

interface D1Result<T = unknown> {
    success: boolean;
    meta: {
        changes?: number;
        duration?: number;
        last_row_id?: number;
        rows_read?: number;
        rows_written?: number;
    };
    results?: T[];
}

interface D1PreparedStatement {
    bind(...values: D1Value[]): D1PreparedStatement;
    run<T = unknown>(): Promise<D1Result<T>>;
    all<T = unknown>(): Promise<D1Result<T>>;
    first<T = unknown>(): Promise<T | null>;
}

interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<void>;
}

declare module "*.css" {
    const content: string;
    export default content;
}
