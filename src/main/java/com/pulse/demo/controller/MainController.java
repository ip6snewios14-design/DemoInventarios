package com.pulse.demo.controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class MainController {

    @GetMapping("/")
    public String index(HttpSession session) {
        if (session.getAttribute("role") != null) {
            return "redirect:/app";
        }
        return "redirect:/login";
    }

    @GetMapping("/login")
    public String loginPage(HttpSession session) {
        if (session.getAttribute("role") != null) {
            return "redirect:/app";
        }
        return "login";
    }

    @PostMapping("/login")
    public String loginSubmit(@RequestParam String username,
            @RequestParam String password,
            HttpSession session,
            Model model) {

        if (username.equals("admin") && password.equals("admin123")) {
            session.setAttribute("role", "admin");
            session.setAttribute("username", username);
            return "redirect:/app";

        } else if (username.equals("user") && password.equals("user123")) {
            session.setAttribute("role", "user");
            session.setAttribute("username", username);
            return "redirect:/app";

        } else {
            model.addAttribute("error", true);
            return "login";
        }
    }

    @GetMapping("/app")
    public String appPage(HttpSession session, Model model) {
        String role = (String) session.getAttribute("role");
        String username = (String) session.getAttribute("username");

        if (role == null) {
            return "redirect:/login";
        }

        model.addAttribute("role", role);
        model.addAttribute("username", username);

        // Admin va a app.html, empleado a user.html
        return role.equals("admin") ? "app" : "user";
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }
}