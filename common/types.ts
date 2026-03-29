export type Tags = Record<string, string[]>;

export type Versions = Record<string, string>;

export interface Csproj {
    Project: Project | undefined;
}

export interface Project {
    PropertyGroup: PropertyGroup | undefined;
}

export interface PropertyGroup {
    IsPackable: string | undefined;
    Version: string | undefined;
}
