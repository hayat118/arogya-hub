import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Colors from "../constants/Colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface DateItem {
  date: Date;
  dayName: string; // e.g. "Mon"
  dayNumber: number; // e.g. 18
  isToday: boolean;
  id: string; // e.g. "2026-08-18"
}

interface WeekItem {
  id: string; // e.g. "week-4"
  days: DateItem[];
}

interface WeeklyCalendarProps {
  selectedDateId: string;
  onDateSelect: (dateId: string) => void;
}

// Generate weeks: only the previous week and the current week (total 2 weeks)
const generateWeeks = (): WeekItem[] => {
  const weeks: WeekItem[] = [];
  const today = new Date();

  // Find Monday of the current week
  const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + distanceToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  for (let w = -1; w <= 0; w++) {
    const weekDays: DateItem[] = [];
    const weekMonday = new Date(currentMonday);
    weekMonday.setDate(currentMonday.getDate() + w * 7);

    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(weekMonday);
      dayDate.setDate(weekMonday.getDate() + d);

      const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" }); // "Mon"
      const dayNumber = dayDate.getDate();
      const isToday =
        dayDate.getDate() === today.getDate() &&
        dayDate.getMonth() === today.getMonth() &&
        dayDate.getFullYear() === today.getFullYear();

      const id = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(
        dayDate.getDate()
      ).padStart(2, "0")}`;

      weekDays.push({
        date: dayDate,
        dayName,
        dayNumber,
        isToday,
        id,
      });
    }

    weeks.push({
      id: `week-${w}`,
      days: weekDays,
    });
  }
  return weeks;
};

export default function WeeklyCalendar({ selectedDateId, onDateSelect }: WeeklyCalendarProps) {
  const [weeks] = useState<WeekItem[]>(generateWeeks);
  const flatListRef = useRef<FlatList<WeekItem>>(null);

  // Auto-scroll to show the week containing "Today" (the current week) on mount
  useEffect(() => {
    const todayWeekIndex = weeks.findIndex((w) => w.days.some((d) => d.isToday));
    if (todayWeekIndex !== -1) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: todayWeekIndex,
          animated: false,
        });
      }, 150);
    }
  }, [weeks]);

  const handleDatePress = (item: DateItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    onDateSelect(item.id);
  };

  const renderWeekPage = ({ item: week }: { item: WeekItem }) => {
    return (
      <View style={styles.weekPageContainer}>
        {week.days.map((dayItem) => {
          const isSelected = dayItem.id === selectedDateId;

          return (
            <TouchableOpacity
              key={dayItem.id}
              style={[
                styles.dayColumn,
                isSelected && styles.dayColumnSelected,
                dayItem.isToday && !isSelected && styles.dayColumnToday,
              ]}
              onPress={() => handleDatePress(dayItem)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isSelected && styles.dayLabelSelected,
                  dayItem.isToday && !isSelected && styles.dayLabelToday,
                ]}
              >
                {dayItem.dayName}
              </Text>
              <View
                style={[
                  styles.dateCircle,
                  isSelected && styles.dateCircleSelected,
                  dayItem.isToday && !isSelected && styles.dateCircleToday,
                ]}
              >
                <Text
                  style={[
                    styles.dateNumber,
                    isSelected && styles.dateNumberSelected,
                    dayItem.isToday && !isSelected && styles.dateNumberToday,
                  ]}
                >
                  {dayItem.dayNumber}
                </Text>
              </View>
              {/* Today indicator dot at the bottom inside the column */}
              {dayItem.isToday && (
                <View
                  style={[styles.todayIndicator, isSelected && styles.todayIndicatorSelected]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={weeks}
        renderItem={renderWeekPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.background,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.03)",
  },
  weekPageContainer: {
    width: SCREEN_WIDTH,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  dayColumn: {
    width: 44,
    height: 76,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)", // Capsule border wrapping both day label and date circle
    position: "relative",
    paddingVertical: 8,
  },
  dayColumnSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: "rgba(41, 143, 80, 0.08)", // Subtle green tint background
  },
  dayColumnToday: {
    borderColor: "rgba(41, 143, 80, 0.4)",
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  dayLabelSelected: {
    color: Colors.dark.primary,
    fontWeight: "700",
  },
  dayLabelToday: {
    color: Colors.dark.primary,
    fontWeight: "600",
  },
  dateCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  dateCircleSelected: {
    backgroundColor: Colors.dark.primary,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dateCircleToday: {
    backgroundColor: "rgba(41, 143, 80, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(41, 143, 80, 0.2)",
  },
  dateNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  dateNumberSelected: {
    color: Colors.dark.white,
    fontWeight: "800",
  },
  dateNumberToday: {
    color: Colors.dark.primary,
    fontWeight: "700",
  },
  todayIndicator: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.primary,
  },
  todayIndicatorSelected: {
    backgroundColor: Colors.dark.white,
  },
});
