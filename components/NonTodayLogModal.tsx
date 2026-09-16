import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/Colors";

interface NonTodayLogModalProps {
  visible: boolean;
  activeDate: string;
  onClose: () => void;
  onSwitchToToday?: () => void;
}

export default function NonTodayLogModal({
  visible,
  activeDate,
  onClose,
}: NonTodayLogModalProps) {
  // Format activeDate for human-readable display e.g. "Sep 8, 2026"
  const formattedDate = () => {
    if (!activeDate) return "a previous/future date";
    try {
      const [y, m, d] = activeDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return activeDate;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header Cross Icon Logo */}
              <View style={styles.iconContainer}>
                <Ionicons name="close-circle-sharp" size={36} color="#EF4444" />
              </View>

              {/* Title */}
              <Text style={styles.title}>Logging Restricted</Text>

              {/* Message Body */}
              <Text style={styles.message}>
                You are currently attempting to log an activity for{" "}
                <Text style={styles.highlightText}>{formattedDate()}</Text>.
                {"\n\n"}
                To keep your daily habit streak and progress tracking accurate, activities can only be logged for <Text style={styles.highlightText}>Today</Text>.
              </Text>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1E202C",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2C2E3E",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  highlightText: {
    color: "#F3F4F6",
    fontWeight: "700",
  },
  cancelButton: {
    width: "100%",
    backgroundColor: "#2A2D3D",
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
