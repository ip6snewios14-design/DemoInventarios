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
        // Si ya hay sesión activa, manda directo a la app
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
        return "login"; // → templates/login.html
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
            return "login"; // regresa al login con el mensaje de error
        }
    }

    @GetMapping("/app")
    public String appPage(HttpSession session, Model model) {
        String role = (String) session.getAttribute("role");

        // Si no hay sesión, manda al login
        if (role == null) {
            return "redirect:/login";
        }

        // Inyecta el rol en el modelo para que Thymeleaf lo use en el HTML
        model.addAttribute("role", role);
        model.addAttribute("username", session.getAttribute("username"));
        return "app"; // → templates/app.html
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/login";
    }
}