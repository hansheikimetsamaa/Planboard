// Defines the constrained values used by task data, placement, and map rendering.

namespace Planboard.Data
{
    public enum EntryKind : byte { Issue, Task, Idea }
    public enum EntryStatus : byte { Open, Doing, Done }
    public enum EntryPriority : byte { None, Low, Medium, High }
    public enum SpatialKind : byte { None, Point, Line, Area }
    public enum LinkState : byte { Unlinked, Valid, Missing }
    public enum PlacementState : byte { Inactive, ChoosingLocation, ValidPreview, InvalidPreview, Applied, Cancelled }

    public enum EntryCategory : byte
    {
        Traffic,
        Roads,
        PublicTransport,
        WalkingCycling,
        ZoningDevelopment,
        CityServices,
        Utilities,
        ParksPublicSpace,
        FutureProject,
        General
    }
}
