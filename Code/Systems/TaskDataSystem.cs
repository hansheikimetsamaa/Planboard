using System;
using System.Collections.Generic;
using System.Linq;
using Colossal.Serialization.Entities;
using Game;
using Planboard.Data;
using Unity.Entities;
using Unity.Mathematics;

namespace Planboard.Systems
{
    public partial class TaskDataSystem : GameSystemBase, IDefaultSerializable
    {
        public const int CurrentFormatVersion = 2;
        public const int MaxCategoryLength = 40;
        public const int MaxTitleLength = 160;
        public const int MaxDescriptionLength = 4000;
        public const int MaxEntries = 10000;

        private readonly List<TaskEntry> _entries = new();
        private readonly List<string> _dataIssues = new();
        private readonly HashSet<int> _transientEntryIds = new();
        private int _nextId = 1;
        private uint _revision;
        private bool _pendingValidation;

        public IReadOnlyList<TaskEntry> Entries => _entries;
        public IReadOnlyList<string> DataIssues => _dataIssues;
        public uint Revision => _revision;
        internal bool PendingValidation => _pendingValidation;

        protected override void OnCreate()
        {
            base.OnCreate();
            Enabled = true;
        }

        protected override void OnUpdate() { }

        protected override void OnGameLoaded(Context serializationContext)
        {
            base.OnGameLoaded(serializationContext);
            _pendingValidation = true;
        }

        public TaskEntry Find(int id) => _entries.FirstOrDefault(entry => entry.Id == id);

        public int CreateEntry(string title, EntryKind kind, EntryCategory category, string customCategory = "", bool transient = false)
        {
            if (_entries.Count >= MaxEntries) return 0;
            long now = DateTime.UtcNow.Ticks;
            TaskEntry entry = new()
            {
                Id = _nextId++,
                Title = CleanTitle(title),
                Kind = Enum.IsDefined(typeof(EntryKind), kind) ? kind : EntryKind.Task,
                Category = Enum.IsDefined(typeof(EntryCategory), category) ? category : EntryCategory.General,
                CustomCategory = CleanCategory(customCategory),
                CreatedUtcTicks = now,
                UpdatedUtcTicks = now,
            };
            _entries.Add(entry);
            if (transient) _transientEntryIds.Add(entry.Id);
            Touch();
            return entry.Id;
        }

        public bool CommitTransientEntry(int id)
        {
            if (Find(id) == null) return false;
            return _transientEntryIds.Remove(id);
        }

        public bool IsTransientEntry(int id) => _transientEntryIds.Contains(id);

        public bool UpdateEntry(
            int id,
            string title,
            string description,
            EntryKind kind,
            EntryCategory category,
            string customCategory,
            EntryStatus status,
            EntryPriority priority,
            long realDueDateTicks,
            long gameDueDateTicks)
        {
            TaskEntry entry = Find(id);
            if (entry == null) return false;
            string nextTitle = CleanTitle(title);
            string nextDescription = CleanDescription(description);
            EntryKind nextKind = Enum.IsDefined(typeof(EntryKind), kind) ? kind : EntryKind.Task;
            EntryCategory nextCategory = Enum.IsDefined(typeof(EntryCategory), category) ? category : EntryCategory.General;
            string nextCustomCategory = CleanCategory(customCategory);
            EntryStatus nextStatus = Enum.IsDefined(typeof(EntryStatus), status) ? status : EntryStatus.Open;
            EntryPriority nextPriority = Enum.IsDefined(typeof(EntryPriority), priority) ? priority : EntryPriority.None;
            long nextRealDueDateTicks = SanitizeTicks(realDueDateTicks);
            long nextGameDueDateTicks = SanitizeTicks(gameDueDateTicks);
            if (entry.Title == nextTitle && entry.Description == nextDescription && entry.Kind == nextKind &&
                entry.Category == nextCategory && entry.CustomCategory == nextCustomCategory &&
                entry.Status == nextStatus && entry.Priority == nextPriority &&
                entry.RealDueDateTicks == nextRealDueDateTicks && entry.GameDueDateTicks == nextGameDueDateTicks)
                return true;
            entry.Title = nextTitle;
            entry.Description = nextDescription;
            entry.Kind = nextKind;
            entry.Category = nextCategory;
            entry.CustomCategory = nextCustomCategory;
            entry.Status = nextStatus;
            entry.Priority = nextPriority;
            entry.RealDueDateTicks = nextRealDueDateTicks;
            entry.GameDueDateTicks = nextGameDueDateTicks;
            entry.UpdatedUtcTicks = DateTime.UtcNow.Ticks;
            Touch();
            return true;
        }

        public bool RestoreEntry(TaskEntry snapshot)
        {
            if (snapshot == null || Find(snapshot.Id) != null || _entries.Count >= MaxEntries) return false;
            _entries.Add(snapshot.Clone());
            if (_nextId <= snapshot.Id) _nextId = snapshot.Id + 1;
            Touch();
            return true;
        }
        public bool DeleteEntry(int id)
        {
            int removed = _entries.RemoveAll(entry => entry.Id == id);
            if (removed == 0) return false;
            _transientEntryIds.Remove(id);
            Touch();
            return true;
        }

        public bool SetStatus(int id, EntryStatus status)
        {
            TaskEntry entry = Find(id);
            if (entry == null || !Enum.IsDefined(typeof(EntryStatus), status)) return false;
            if (entry.Status == status) return true;
            entry.Status = status;
            entry.UpdatedUtcTicks = DateTime.UtcNow.Ticks;
            Touch();
            return true;
        }

        public bool ConvertIdeaToTask(int id)
        {
            TaskEntry entry = Find(id);
            if (entry == null || entry.Kind != EntryKind.Idea) return false;
            entry.Kind = EntryKind.Task;
            entry.UpdatedUtcTicks = DateTime.UtcNow.Ticks;
            Touch();
            return true;
        }

        public bool SetLocation(int id, float3 position, Entity linkedEntity, Entity linkedDistrict, bool markerMoved)
        {
            TaskEntry entry = Find(id);
            if (entry == null || !math.all(math.isfinite(position))) return false;
            entry.SpatialKind = SpatialKind.Point;
            entry.Position = position;
            entry.LinkedEntity = linkedEntity;
            entry.LinkedDistrict = linkedDistrict;
            entry.MarkerMoved = markerMoved;
            entry.LinkState = linkedEntity != Entity.Null || linkedDistrict != Entity.Null ? LinkState.Valid : LinkState.Unlinked;
            entry.UpdatedUtcTicks = DateTime.UtcNow.Ticks;
            Touch();
            return true;
        }

        public bool RemoveLocation(int id)
        {
            TaskEntry entry = Find(id);
            if (entry == null) return false;
            if (!entry.HasLocation && entry.LinkedEntity == Entity.Null && entry.LinkedDistrict == Entity.Null) return true;
            entry.SpatialKind = SpatialKind.None;
            entry.Position = default;
            entry.LinkedEntity = Entity.Null;
            entry.LinkedDistrict = Entity.Null;
            entry.MarkerMoved = false;
            entry.LinkState = LinkState.Unlinked;
            entry.UpdatedUtcTicks = DateTime.UtcNow.Ticks;
            Touch();
            return true;
        }

        internal void ValidateLoadedData(EntityManager entityManager)
        {
            _dataIssues.Clear();
            HashSet<int> ids = new();
            int maxId = 0;

            for (int i = _entries.Count - 1; i >= 0; i--)
            {
                TaskEntry entry = _entries[i];
                if (entry.Id <= 0 || !ids.Add(entry.Id))
                {
                    int oldId = entry.Id;
                    entry.Id = NextUnusedId(ids);
                    ids.Add(entry.Id);
                    _dataIssues.Add($"Entry {oldId} had an invalid or duplicate ID and was reassigned to {entry.Id}.");
                }

                maxId = Math.Max(maxId, entry.Id);
                entry.Title = CleanTitle(entry.Title);
                entry.Description = CleanDescription(entry.Description);
                if (!Enum.IsDefined(typeof(EntryKind), entry.Kind)) entry.Kind = EntryKind.Task;
                if (!Enum.IsDefined(typeof(EntryCategory), entry.Category)) entry.Category = EntryCategory.General;
                entry.CustomCategory = CleanCategory(entry.CustomCategory);
                if (!Enum.IsDefined(typeof(EntryStatus), entry.Status)) entry.Status = EntryStatus.Open;
                if (!Enum.IsDefined(typeof(EntryPriority), entry.Priority)) entry.Priority = EntryPriority.None;
                if (entry.CreatedUtcTicks <= 0) entry.CreatedUtcTicks = DateTime.UtcNow.Ticks;
                if (entry.UpdatedUtcTicks <= 0) entry.UpdatedUtcTicks = entry.CreatedUtcTicks;
                entry.RealDueDateTicks = SanitizeTicks(entry.RealDueDateTicks);
                entry.GameDueDateTicks = SanitizeTicks(entry.GameDueDateTicks);

                if (entry.SpatialKind != SpatialKind.None && entry.SpatialKind != SpatialKind.Point)
                {
                    entry.SpatialKind = SpatialKind.None;
                    _dataIssues.Add($"Entry {entry.Id} used unsupported V1 geometry and was changed to list-only.");
                }
                if (entry.HasLocation && !math.all(math.isfinite(entry.Position)))
                {
                    entry.SpatialKind = SpatialKind.None;
                    entry.Position = default;
                    _dataIssues.Add($"Entry {entry.Id} had invalid coordinates and was changed to list-only.");
                }

                bool linked = entry.LinkedEntity != Entity.Null || entry.LinkedDistrict != Entity.Null;
                bool valid = !linked ||
                    (entry.LinkedEntity == Entity.Null || entityManager.Exists(entry.LinkedEntity)) &&
                    (entry.LinkedDistrict == Entity.Null || entityManager.Exists(entry.LinkedDistrict));
                entry.LinkState = !linked ? LinkState.Unlinked : valid ? LinkState.Valid : LinkState.Missing;
            }

            _nextId = Math.Max(_nextId, maxId + 1);
            _pendingValidation = false;
            Touch();
        }

        private static int NextUnusedId(HashSet<int> ids)
        {
            int value = 1;
            while (ids.Contains(value)) value++;
            return value;
        }

        private static string CleanTitle(string value)
        {
            string result = (value ?? string.Empty).Trim();
            if (result.Length > MaxTitleLength) result = result.Substring(0, MaxTitleLength);
            return string.IsNullOrWhiteSpace(result) ? "Untitled" : result;
        }

        private static string CleanCategory(string value)
        {
            string result = (value ?? string.Empty).Trim();
            return result.Length <= MaxCategoryLength ? result : result.Substring(0, MaxCategoryLength);
        }

        private static string CleanDescription(string value)
        {
            string result = value ?? string.Empty;
            return result.Length <= MaxDescriptionLength ? result : result.Substring(0, MaxDescriptionLength);
        }

        private static long SanitizeTicks(long ticks)
        {
            return ticks >= DateTime.MinValue.Ticks && ticks <= DateTime.MaxValue.Ticks ? ticks : 0;
        }

        private void Touch() { unchecked { _revision++; } }

        public void SetDefaults(Context context)
        {
            _entries.Clear();
            _dataIssues.Clear();
            _transientEntryIds.Clear();
            _nextId = 1;
            _revision = 0;
            _pendingValidation = true;
        }

        public void Serialize<TWriter>(TWriter writer) where TWriter : IWriter
        {
            writer.Write(CurrentFormatVersion);
            writer.Write(_nextId);
            int persistentCount = _entries.Count(entry => !_transientEntryIds.Contains(entry.Id));
            writer.Write(persistentCount);
            foreach (TaskEntry entry in _entries.Where(entry => !_transientEntryIds.Contains(entry.Id)))
            {
                writer.Write(entry.Id);
                writer.Write(entry.Title);
                writer.Write(entry.Description);
                writer.Write((byte)entry.Kind);
                writer.Write((byte)entry.Category);
                writer.Write((byte)entry.Status);
                writer.Write((byte)entry.Priority);
                writer.Write(entry.CreatedUtcTicks);
                writer.Write(entry.UpdatedUtcTicks);
                writer.Write(entry.RealDueDateTicks);
                writer.Write(entry.GameDueDateTicks);
                writer.Write((byte)entry.SpatialKind);
                writer.Write(entry.Position.x);
                writer.Write(entry.Position.y);
                writer.Write(entry.Position.z);
                writer.Write(entry.LinkedEntity);
                writer.Write(entry.LinkedDistrict);
                writer.Write(entry.MarkerMoved);
                writer.Write(entry.CustomCategory);
            }
        }

        public void Deserialize<TReader>(TReader reader) where TReader : IReader
        {
            _entries.Clear();
            _dataIssues.Clear();
            _transientEntryIds.Clear();
            reader.Read(out int version);
            if (version < 1 || version > CurrentFormatVersion)
            {
                _dataIssues.Add($"Unsupported Planboard data version: {version}.");
                _pendingValidation = true;
                return;
            }

            reader.Read(out _nextId);
            reader.Read(out int serializedCount);
            if (serializedCount < 0) serializedCount = 0;
            if (serializedCount > MaxEntries)
                _dataIssues.Add($"Planboard contained {serializedCount} entries; only the first {MaxEntries} were restored.");
            for (int i = 0; i < serializedCount; i++)
            {
                TaskEntry entry = new();
                reader.Read(out entry.Id);
                reader.Read(out entry.Title);
                reader.Read(out entry.Description);
                reader.Read(out byte kind); entry.Kind = (EntryKind)kind;
                reader.Read(out byte category); entry.Category = (EntryCategory)category;
                reader.Read(out byte status); entry.Status = (EntryStatus)status;
                reader.Read(out byte priority); entry.Priority = (EntryPriority)priority;
                reader.Read(out entry.CreatedUtcTicks);
                reader.Read(out entry.UpdatedUtcTicks);
                reader.Read(out entry.RealDueDateTicks);
                reader.Read(out entry.GameDueDateTicks);
                reader.Read(out byte spatialKind); entry.SpatialKind = (SpatialKind)spatialKind;
                reader.Read(out entry.Position.x);
                reader.Read(out entry.Position.y);
                reader.Read(out entry.Position.z);
                reader.Read(out entry.LinkedEntity);
                reader.Read(out entry.LinkedDistrict);
                reader.Read(out entry.MarkerMoved);
                if (version >= 2) reader.Read(out entry.CustomCategory);
                if (i < MaxEntries) _entries.Add(entry);
            }
            _pendingValidation = true;
        }
    }
}
