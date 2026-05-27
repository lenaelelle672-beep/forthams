package com.ams.datascope;

public class DataScopeContextHolder {

    private static final ThreadLocal<DataScopeMeta> CONTEXT = new ThreadLocal<>();

    public static void set(DataScopeMeta meta) { CONTEXT.set(meta); }

    public static DataScopeMeta get() { return CONTEXT.get(); }

    public static void clear() { CONTEXT.remove(); }
}
